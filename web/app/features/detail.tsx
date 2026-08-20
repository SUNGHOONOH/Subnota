'use client';

/* 상세 페이지 공통 골격. 대표 흐름이 가장 크고, 추가 기능은 그보다 작은
   장면으로 옆에 설명이 붙는다 — 순서가 뒤집히면 메인에서 챕터를 나눈 이유가
   사라진다. */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft } from '../subnota-ui/icons';
import { DownloadRow } from '../components/site';

export function DetailHero({
  chip,
  title,
  lead,
}: {
  chip: string;
  title: string;
  lead: string;
}) {
  return (
    <section className="detail-hero shell">
      <Link className="back-link" href="/">
        <ChevronLeft />
        전체 기능으로
      </Link>
      <span className="chapter-chip">{chip}</span>
      <h1>{title}</h1>
      <p className="detail-lead">{lead}</p>
    </section>
  );
}

export function DetailSection({
  label,
  title,
  body,
  children,
}: {
  label: string;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <section className="detail-section shell">
      <p className="detail-section-label">{label}</p>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      {children && <div className="chapter-stage">{children}</div>}
    </section>
  );
}

/* 추가 기능 카드. 실제 UI 조각을 자유롭게 얹은 무대 + 그 아래 설명.
   대표 흐름보다 작게 유지하는 것이 이 카드의 존재 이유다 — 크기가 뒤집히면
   메인에서 챕터를 나눈 이유가 사라진다. */
export function FeatureCard({
  title,
  body,
  note,
  wide,
  children,
}: {
  title: string;
  body: string;
  note?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <article className={wide ? 'feature-card wide' : 'feature-card'}>
      <div className="feature-card-stage">{children}</div>
      <div className="feature-card-body">
        <h3>{title}</h3>
        <p>{body}</p>
        {note && <p className="feature-card-note">{note}</p>}
      </div>
    </article>
  );
}

export function FeatureGrid({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'blue' | 'green' | 'amber' | 'clay';
}) {
  return (
    <div className={tone ? `feature-grid tone-${tone}` : 'feature-grid'}>
      {children}
    </div>
  );
}

/* 무대 위에 조각을 놓는 자리. 기울기와 위치로만 배치한다. */
export function Piece({
  children,
  x = 0,
  y = 0,
  rotate = 0,
  scale = 1,
  z = 1,
  width,
}: {
  children: ReactNode;
  x?: number;
  y?: number;
  rotate?: number;
  scale?: number;
  z?: number;
  width?: number;
}) {
  return (
    <div
      className="feature-piece"
      style={{
        transform: `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale})`,
        width,
        zIndex: z,
      }}
    >
      {children}
    </div>
  );
}

export function DetailCta() {
  return (
    <section className="download-cta shell">
      <h2>먼저 적으세요. 잇는 일은 Subnota가 합니다.</h2>
      <p>
        첫 메모는 로그인 없이 시작할 수 있습니다. 적은 것은 기기 안에 먼저
        저장되고, 네트워크가 없어도 쓰는 흐름은 끊기지 않습니다.
      </p>
      <DownloadRow />
    </section>
  );
}
