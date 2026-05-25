import { ArrowRight, Laptop, MonitorDown, Smartphone } from 'lucide-react';

const downloadTargets = [
  {
    href: process.env.NEXT_PUBLIC_MACOS_DOWNLOAD_URL ?? '#download',
    icon: Laptop,
    label: 'Mac용 다운로드',
    meta: 'macOS Universal',
    platform: 'macOS',
  },
  {
    href: process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL ?? '#download',
    icon: MonitorDown,
    label: 'Windows용 다운로드',
    meta: 'Windows 10 이상',
    platform: 'Windows',
  },
  {
    href: process.env.NEXT_PUBLIC_IOS_DOWNLOAD_URL ?? '#download',
    icon: Smartphone,
    label: 'iOS 앱 받기',
    meta: 'iPhone',
    platform: 'iOS',
  },
];

export default function DownloadButtons() {
  return (
    <div className="download-buttons" aria-label="플랫폼별 다운로드">
      {downloadTargets.map(item => (
        <a className="download-button" href={item.href} key={item.platform}>
          <span className="download-icon" aria-hidden="true">
            <item.icon size={24} />
          </span>
          <span className="download-copy">
            <span className="download-meta">{item.meta}</span>
            <strong>{item.label}</strong>
          </span>
          <ArrowRight className="download-arrow" aria-hidden="true" size={18} />
        </a>
      ))}
    </div>
  );
}
