import { http, invalidateServerData } from '@pterodactyl/sdk';

/** A file or folder in a listing, as the client API returns it. */
export interface Entry {
    readonly name: string;
    readonly size: number;
    readonly isFile: boolean;
    readonly modifiedAt: string;
}

interface ListResponse {
    data: { attributes: { name: string; size: number; is_file: boolean; modified_at: string } }[];
}

const base = (id: string) => `/api/client/servers/${id}`;

/** Thin wrappers over the panel's client file and console API, bound to one server. */
export function serverApi(id: string) {
    return {
        async list(directory: string): Promise<Entry[]> {
            const { data } = await http.get<ListResponse>(`${base(id)}/files/list`, { params: { directory } });
            return data.data.map(({ attributes: a }) => ({
                name: a.name,
                size: a.size,
                isFile: a.is_file,
                modifiedAt: a.modified_at,
            }));
        },
        /** A directory's entries, or an empty list when it does not exist yet. */
        async listOrEmpty(directory: string): Promise<Entry[]> {
            try {
                return await this.list(directory);
            } catch {
                return [];
            }
        },
        async read(file: string): Promise<string> {
            const { data } = await http.get<string>(`${base(id)}/files/contents`, {
                params: { file },
                responseType: 'text',
                transformResponse: (raw) => raw,
            });
            return data;
        },
        async readOrNull(file: string): Promise<string | null> {
            try {
                return await this.read(file);
            } catch {
                return null;
            }
        },
        async write(file: string, content: string): Promise<void> {
            await http.post(`${base(id)}/files/write`, content, {
                params: { file },
                headers: { 'Content-Type': 'text/plain' },
            });
            await invalidateServerData(id, ['files', 'fileContent']);
        },
        /** Wings downloads the URL itself; `foreground` waits until the file is on disk. */
        async pull(url: string, directory: string, filename?: string): Promise<void> {
            await http.post(`${base(id)}/files/pull`, {
                url,
                directory,
                ...(filename ? { filename } : {}),
                use_header: !filename,
                foreground: true,
            });
            await invalidateServerData(id, ['files']);
        },
        async rename(root: string, from: string, to: string): Promise<void> {
            await http.put(`${base(id)}/files/rename`, { root, files: [{ from, to }] });
            await invalidateServerData(id, ['files']);
        },
        async remove(root: string, files: string[]): Promise<void> {
            await http.post(`${base(id)}/files/delete`, { root, files });
            await invalidateServerData(id, ['files']);
        },
        async mkdir(root: string, name: string): Promise<void> {
            await http.post(`${base(id)}/files/create-folder`, { root, name });
        },
        async decompress(root: string, file: string): Promise<void> {
            await http.post(`${base(id)}/files/decompress`, { root, file });
            await invalidateServerData(id, ['files']);
        },
        /** Uploads files straight to Wings through a signed URL; not rate limited like `pull`. */
        async upload(directory: string, files: File[]): Promise<void> {
            if (files.length === 0) return;
            const { data } = await http.get<{ attributes: { url: string } }>(`${base(id)}/files/upload`);
            const target = new URL(data.attributes.url, window.location.href);
            target.searchParams.set('directory', directory);
            const form = new FormData();
            for (const file of files) form.append('files', file, file.name);
            const response = await fetch(target, { method: 'POST', body: form });
            if (!response.ok) throw new Error(`Uploading to ${directory} failed (${response.status}).`);
            await invalidateServerData(id, ['files']);
        },
        /**
         * Puts one remote file on the server. The browser downloads it and uploads it when the host allows
         * it and it fits the node's upload limit; otherwise Wings pulls it (5 pulls per 10 minutes).
         */
        async install(url: string, directory: string, filename: string, options: InstallOptions = {}): Promise<'upload' | 'pull'> {
            const file = await fetchAsFile(url, filename, (options.maxMb ?? 100) * 1024 * 1024, options.fetcher);
            if (file) {
                await this.upload(directory, [file]);
                return 'upload';
            }
            await this.pull(url, directory, filename);
            return 'pull';
        },
        /** Installs many files: downloads a few at a time, uploads them in batches per folder, pulls what cannot be fetched. */
        async installMany(items: readonly InstallItem[], options: InstallOptions & ManyOptions = {}): Promise<InstallSummary> {
            return installMany(this, items, options);
        },
        async command(command: string): Promise<void> {
            await http.post(`${base(id)}/command`, { command });
        },
        async power(signal: 'start' | 'stop' | 'restart' | 'kill'): Promise<void> {
            await http.post(`${base(id)}/power`, { signal });
        },
        async setVariable(key: string, value: string): Promise<void> {
            await http.put(`${base(id)}/startup/variable`, { key, value });
            await invalidateServerData(id, ['startup']);
        },
        async setDockerImage(image: string): Promise<void> {
            await http.put(`${base(id)}/settings/docker-image`, { docker_image: image });
            await invalidateServerData(id, ['server', 'startup']);
        },
    };
}

export type ServerApi = ReturnType<typeof serverApi>;

/** A JSON GET against a public API, such as Modrinth's. */
export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...init, headers: { Accept: 'application/json', ...init?.headers } });
    if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}.`);
    return (await response.json()) as T;
}

/** A safe file name for a download: letters, digits, dots, dashes and underscores. */
export const safeName = (name: string) => name.replace(/[^\w.+-]+/g, '-').replace(/^-+|-+$/g, '') || 'download.jar';

export interface InstallOptions {
    /** The node's upload limit in MiB (`server.attributes.upload_size`). */
    readonly maxMb?: number;
    readonly fetcher?: typeof fetch;
}

export interface InstallItem {
    readonly url: string;
    readonly directory: string;
    readonly filename: string;
}

export interface ManyOptions {
    readonly concurrency?: number;
    /** Called as each file lands (or fails), for progress UI. */
    readonly onFile?: (item: InstallItem, result: 'upload' | 'pull' | 'failed', error?: string) => void;
}

export interface InstallSummary {
    readonly uploaded: number;
    readonly pulled: number;
    readonly failed: { item: InstallItem; error: string }[];
}

/** Archives and jars start with "PK"; a page of HTML in their place means the host refused the download. */
const ARCHIVE = /\.(jar|zip|mrpack)$/i;

/**
 * Downloads a URL in the browser as a File, or returns null when it cannot (CORS, network, an HTTP
 * error, larger than `maxBytes`, or not the archive its name promises).
 */
export async function fetchAsFile(url: string, filename: string, maxBytes: number, fetcher: typeof fetch = fetch): Promise<File | null> {
    const controller = new AbortController();
    try {
        const response = await fetcher(url, { signal: controller.signal, redirect: 'follow' });
        if (!response.ok) return null;
        const length = Number(response.headers.get('content-length') ?? 0);
        if (length > maxBytes) {
            controller.abort();
            return null;
        }
        const blob = await response.blob();
        if (blob.size === 0 || blob.size > maxBytes) return null;
        if (ARCHIVE.test(filename)) {
            const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
            if (head[0] !== 0x50 || head[1] !== 0x4b) return null;
        }
        return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    } catch {
        return null;
    }
}

/** Upload batches stay small, so one failure does not lose much and progress keeps moving. */
const BATCH_FILES = 12;
const BATCH_BYTES = 48 * 1024 * 1024;

export async function installMany(
    api: Pick<ServerApi, 'upload' | 'pull'>,
    items: readonly InstallItem[],
    options: InstallOptions & ManyOptions = {}
): Promise<InstallSummary> {
    const maxBytes = (options.maxMb ?? 100) * 1024 * 1024;
    const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 4));
    const pending = new Map<string, { item: InstallItem; file: File }[]>();
    const toPull: InstallItem[] = [];
    let uploaded = 0;
    let pulled = 0;
    const failed: { item: InstallItem; error: string }[] = [];

    const flush = async (directory: string) => {
        const batch = pending.get(directory) ?? [];
        pending.delete(directory);
        if (batch.length === 0) return;
        try {
            await api.upload(directory, batch.map((b) => b.file));
            uploaded += batch.length;
            batch.forEach((b) => options.onFile?.(b.item, 'upload'));
        } catch {
            // An upload that fails falls back to pulling each file.
            toPull.push(...batch.map((b) => b.item));
        }
    };

    const queue = [...items];
    const worker = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
            const file = await fetchAsFile(item.url, item.filename, maxBytes, options.fetcher);
            if (!file) {
                toPull.push(item);
                continue;
            }
            const list = [...(pending.get(item.directory) ?? []), { item, file }];
            pending.set(item.directory, list);
            const size = list.reduce((sum, b) => sum + b.file.size, 0);
            if (list.length >= BATCH_FILES || size >= BATCH_BYTES) await flush(item.directory);
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    for (const directory of [...pending.keys()]) await flush(directory);

    for (const item of toPull) {
        try {
            await api.pull(item.url, item.directory, item.filename);
            pulled++;
            options.onFile?.(item, 'pull');
        } catch (error) {
            const message = isRateLimited(error)
                ? 'The panel allows 5 server downloads every 10 minutes. Try again later.'
                : error instanceof Error
                  ? error.message
                  : 'Download failed';
            failed.push({ item, error: message });
            options.onFile?.(item, 'failed', message);
        }
    }

    return { uploaded, pulled, failed };
}

const isRateLimited = (error: unknown) =>
    typeof error === 'object' && error !== null && (error as { response?: { status?: number } }).response?.status === 429;
