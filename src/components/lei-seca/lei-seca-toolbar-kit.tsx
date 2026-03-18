'use client';

import { createPlatePlugin } from 'platejs/react';
import { ScrollableFixedToolbar } from './scrollable-fixed-toolbar';
import { FixedToolbarButtons } from '@/components/ui/fixed-toolbar-buttons';

export const LeiSecaToolbarKit = [
  createPlatePlugin({
    key: 'lei-seca-toolbar',
    render: {
      beforeEditable: () => (
        <ScrollableFixedToolbar>
          <FixedToolbarButtons />
        </ScrollableFixedToolbar>
      ),
    },
  }),
];
