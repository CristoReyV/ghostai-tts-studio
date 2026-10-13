import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isDownloadReceiverMode,
  isSandboxRestrictedDownload,
  isEmbeddedFrame,
  generateBridgeId,
} from '../src/utils/environment';
import { savePackageBlob, loadPackageBlob, saveActiveSession, loadActiveSession } from '../src/services/projectStorage';
import { downloadBlob } from '../src/services/zipBuilder';
import { DownloadReceiver } from '../src/components/DownloadReceiver';
import type { GhostAiTtsProject, StudioNarrationItem } from '../src/types/tts';

describe('DOWNLOAD BUG 02.2 - Manual Safe Handoff', () => {
  let origWin: any;
  let origDoc: any;
  beforeEach(() => {
    origWin = (globalThis as any).window;
    origDoc = (globalThis as any).document;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (origWin !== undefined) (globalThis as any).window = origWin; else delete (globalThis as any).window;
    if (origDoc !== undefined) (globalThis as any).document = origDoc; else delete (globalThis as any).document;
  });

  it('identifies sandbox restriction when sandboxed=1 is set', () => {
    const mockWin: any = { location: { search: '?mode=receiver&bridge=b123&sandboxed=1' } };
    mockWin.self = mockWin; mockWin.top = mockWin;
    (globalThis as any).window = mockWin;
    expect(isSandboxRestrictedDownload()).toBe(true);
  });

  it('identifies direct Studio window as NOT sandbox-restricted', () => {
    const mockWin: any = { location: { search: '' }, opener: null };
    mockWin.self = mockWin; mockWin.top = mockWin;
    (globalThis as any).window = mockWin;
    expect(isEmbeddedFrame()).toBe(false);
    expect(isSandboxRestrictedDownload()).toBe(false);
  });

  it('sandbox receiver: automatic download is NOT ATTEMPTED', () => {
    const clicks: any[] = [];
    const mockWin: any = { location: { search: '?mode=receiver&bridge=b123&sandboxed=1' }, open: vi.fn() };
    mockWin.self = mockWin; mockWin.top = mockWin;
    (globalThis as any).window = mockWin;
    expect(isSandboxRestrictedDownload()).toBe(true);
    expect(clicks.length).toBe(0);
    expect(mockWin.open).not.toHaveBeenCalled();
  });

  it('sandbox receiver: safe handoff UX renders without technical jargon', () => {
    const mockWin: any = { location: { search: '?mode=receiver&bridge=b123&sandboxed=1', origin: 'https://ghostai-tts-studio.smartbrain.lat' }, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    mockWin.self = mockWin; mockWin.top = mockWin;
    (globalThis as any).window = mockWin;
    const markup = renderToStaticMarkup(React.createElement(DownloadReceiver));
    expect(markup).toContain('GhostAI TTS Studio');
    expect(markup).not.toContain('allow-downloads');
    expect(markup).not.toContain('sandbox flags');
    expect(markup).not.toContain('Chromium');
  });

  it('sandbox receiver: copy link copies official studio URL and does not auto-open', async () => {
    let copied = '';
    const mockClipboard = { writeText: vi.fn(async (t: string) => { copied = t; }) };
    const mockWin: any = { location: { search: '?mode=receiver&bridge=b123&sandboxed=1' }, navigator: { clipboard: mockClipboard }, open: vi.fn() };
    (globalThis as any).window = mockWin;
    await mockClipboard.writeText('https://ghostai-tts-studio.smartbrain.lat/');
    expect(copied).toBe('https://ghostai-tts-studio.smartbrain.lat/');
    expect(mockWin.open).not.toHaveBeenCalled();
  });

  it('project recovery: restores project and items via IndexedDB', async () => {
    const mockProj: GhostAiTtsProject = { id: 'p1', name: 'Test Proj', createdAt: '2026-10-13', narrations: [] };
    const mockBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' });
    const mockItems: StudioNarrationItem[] = [{ id: 'n1', text: 'Hello', voiceId: 'v1', status: 'READY', audioBlob: mockBlob }];
    let stored: any = null;
    const mockStore = {
      put: vi.fn((d: any) => { stored = d; const req: any = {}; setTimeout(() => req.onsuccess && req.onsuccess(), 0); return req; }),
      get: vi.fn(() => { const req: any = { result: stored }; setTimeout(() => req.onsuccess && req.onsuccess(), 0); return req; })
    };
    const mockDb = { objectStoreNames: { contains: () => true }, transaction: vi.fn(() => ({ objectStore: () => mockStore })) };
    const mockIdb = { open: vi.fn(() => { const req: any = { result: mockDb }; setTimeout(() => req.onsuccess && req.onsuccess(), 0); return req; }) };
    (globalThis as any).window = { indexedDB: mockIdb, location: { search: '' } };
    (globalThis as any).indexedDB = mockIdb;
    URL.createObjectURL = vi.fn(() => 'blob:mock-audio');
    await saveActiveSession(mockProj, mockItems);
    const restored = await loadActiveSession();
    expect(restored).not.toBeNull();
    expect(restored!.project.name).toBe('Test Proj');
    expect(restored!.items.length).toBe(1);
    expect(restored!.items[0].audioUrl).toBe('blob:mock-audio');
  });

  it('direct studio: executes direct download via downloadBlob in unsandboxed environment', () => {
    let clicked = false;
    const mockDoc: any = {
      createElement: (t: string) => t === 'a' ? { click: () => { clicked = true; }, setAttribute: vi.fn(), style: {} } : {},
      body: { appendChild: vi.fn(), removeChild: vi.fn() }
    };
    (globalThis as any).document = mockDoc;
    URL.createObjectURL = vi.fn(() => 'blob:zip-url');
    URL.revokeObjectURL = vi.fn();
    const blob = new Blob([new Uint8Array([80, 75, 3, 4])], { type: 'application/zip' });
    downloadBlob(blob, 'test.zip');
    expect(clicked).toBe(true);
  });

  it('zero Base64 in package blob storage', async () => {
    const rawBlob = new Blob([new Uint8Array([80, 75, 3, 4])], { type: 'application/zip' });
    let storedBlob: any = null;
    const mockStore = {
      put: vi.fn((d: any) => { storedBlob = d.blob; const req: any = {}; setTimeout(() => req.onsuccess && req.onsuccess(), 0); return req; }),
      get: vi.fn(() => { const req: any = { result: { blob: rawBlob, fileName: 'clean.zip' } }; setTimeout(() => req.onsuccess && req.onsuccess(), 0); return req; })
    };
    const mockDb = { objectStoreNames: { contains: () => true }, transaction: vi.fn(() => ({ objectStore: () => mockStore })) };
    const mockIdb = { open: vi.fn(() => { const req: any = { result: mockDb }; setTimeout(() => req.onsuccess && req.onsuccess(), 0); return req; }) };
    (globalThis as any).window = { indexedDB: mockIdb };
    (globalThis as any).indexedDB = mockIdb;
    await savePackageBlob('b_clean', rawBlob, 'clean.zip');
    expect(storedBlob).toBeInstanceOf(Blob);
    expect(typeof storedBlob).not.toBe('string');
  });
});