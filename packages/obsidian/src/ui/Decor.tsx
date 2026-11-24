/** The background decoration; theme.css shows it only while the "decor" setting is on. */
export default function Decor() {
    return (
        <div className='obs-decor' aria-hidden>
            <svg className='obs-decor-rings' viewBox='0 0 400 400' fill='none' stroke='currentColor' strokeWidth='1.2'>
                <circle cx='200' cy='200' r='198' />
                <circle cx='200' cy='200' r='150' />
                <path d='M20 300 L380 90' />
            </svg>
            <svg className='obs-decor-cube' viewBox='0 0 200 200' fill='none' stroke='currentColor' strokeWidth='1.4'>
                <path d='M100 20 L175 60 L175 145 L100 185 L25 145 L25 60 Z' />
                <path d='M25 60 L100 100 L175 60 M100 100 L100 185' />
            </svg>
        </div>
    );
}
