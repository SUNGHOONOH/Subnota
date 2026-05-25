import { ArrowRight, Laptop, MonitorDown, Smartphone } from 'lucide-react';

const downloadTargets = [
  {
    href: '/app',
    icon: Laptop,
    label: 'Mac용 다운로드',
    meta: 'macOS PWA',
    platform: 'macOS',
  },
  {
    href: '/app',
    icon: MonitorDown,
    label: 'Windows용 다운로드',
    meta: 'Windows PWA',
    platform: 'Windows',
  },
  {
    href: '/app',
    icon: Smartphone,
    label: 'iOS 앱 받기',
    meta: 'iPhone PWA',
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
