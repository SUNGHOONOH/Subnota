'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!projectToken || posthog.__loaded) return;

    posthog.init(projectToken, {
      api_host: host,
      // Anonymous statistics only: do not persist a device identifier or collect IP properties.
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_persistence: true,
      ip: false,
      loaded: (client) => client.register({ platform: 'web', environment: process.env.NODE_ENV }),
    });
  }, []);

  return children;
}
