import axios from 'axios';
import { http } from '@pterodactyl/sdk';

export async function uploadFiles(identifier: string, directory: string, files: File[]): Promise<void> {
    const { data } = await http.get<{ attributes: { url: string } }>(`/api/client/servers/${identifier}/files/upload`);
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    await axios.post(data.attributes.url, form, { params: { directory } });
}

export async function toServerIcon(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot resize images.');

    const side = Math.min(bitmap.width, bitmap.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 64, 64);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not encode the image.');
    return new File([blob], 'server-icon.png', { type: 'image/png' });
}
