import test from 'node:test';
import assert from 'node:assert/strict';
import {studioReturnTo, studioLoginHref} from '../lib/ui/studio-navigation.ts';
import {studioPublicationState} from '../lib/ui/studio-publication-state.ts';

test('login continues known private operations with exercise and milestone context', () => {
  for (const path of ['/studio/private', '/studio/private/management', '/studio/private/system', '/studio/private/projects', '/studio/private/plans', '/studio/private/record/evt-synthetic-1', '/studio/private#supplement', '/studio/private/workspace?practice=string-reverse', '/studio/private/workspace?project=c-engine&milestone=implementation', '/studio/private/projects?project=embedded-controller&milestone=verification#milestone-verification']) {
    assert.equal(studioReturnTo(path), path);
    assert.equal(new URL(studioLoginHref(path), 'https://synthetic.invalid').searchParams.get('returnTo'), path);
  }
  assert.equal(studioReturnTo('/studio/private/workspace?practice=string-reverse&unexpected=secret'), '/studio/private/workspace?practice=string-reverse');
});

test('login rejects external, normalized, encoded and unrecognized return locations', () => {
  for (const value of [undefined, null, ['//evil.invalid'], 'https://evil.invalid', '//evil.invalid/studio/private', '/\\evil.invalid', '/studio/private/../private/plans', '/studio/private/%2e%2e/private/plans', '/studio%2fprivate', '/studio/private/record/%2f%2fevil.invalid', '/api/auth/logout', '/login', '/studio/private\n', '/studio/private/unknown']) {
    assert.equal(studioReturnTo(value), '/studio/private/management', String(value));
  }
  assert.equal(studioReturnTo('/studio/private/workspace?practice=https%3A%2F%2Fevil.invalid'), '/studio/private/workspace');
});

test('publishing explains unsaved, empty, unchanged and unpublished content independently', () => {
  const state = overrides => studioPublicationState({dirty:false, hasDraft:true, hasPublication:true, matchesPublication:true, hasContent:true, ...overrides});
  assert.match(state({dirty:true}).draftLabel, /未保存/);
  assert.match(state({dirty:true}).publishHint, /先保存/);
  assert.match(state({hasDraft:false,hasPublication:false,matchesPublication:false}).publicationLabel, /尚未公开/);
  assert.match(state({matchesPublication:false}).publicationLabel, /待发布/);
  assert.match(state({}).publishHint, /无需重复发布/);
  assert.match(state({hasContent:false,matchesPublication:false}).publishHint, /补充发布内容/);
});
