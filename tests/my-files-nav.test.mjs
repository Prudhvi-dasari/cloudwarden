import test from 'node:test';
import assert from 'node:assert/strict';
import { myFilesAction, myFilesForCompactHeader } from '../src/lib/myFilesNav.js';

test('My Files keeps the home dashboard when that page owns the tab', () => {
  assert.equal(myFilesAction({ hasDashboardToggle: true, hasParentDrawer: true }), 'dashboard');
});

test('My Files uses a page-owned uploads drawer when there is no dashboard tab', () => {
  assert.equal(myFilesAction({ hasParentDrawer: true }), 'parent-drawer');
});

test('My Files opens the shared uploads drawer on pages that have neither', () => {
  assert.equal(myFilesAction(), 'local-drawer');
});

test('compact download and request headers hide My Files until someone is signed in', () => {
  assert.equal(myFilesForCompactHeader(null), 'hidden');
  assert.equal(myFilesForCompactHeader(undefined), 'hidden');
  assert.equal(myFilesForCompactHeader({ email: 'owner@example.com' }), 'local-drawer');
});
