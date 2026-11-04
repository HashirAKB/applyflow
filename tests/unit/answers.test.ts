import { describe, expect, it } from 'vitest';
import { customId, rememberAnswer } from '../../src/core/answers';

describe('answer bank', () => {
  it('adds a new canonical answer with the seen label as alias', () => {
    const bank = rememberAnswer([], { questionId: 'notice_period', label: 'Notice period?', value: '30 days' }, 't1');
    expect(bank).toEqual([{ questionId: 'notice_period', value: '30 days', aliases: ['Notice period?'], updatedAt: 't1' }]);
  });

  it('updates the value and accumulates distinct aliases', () => {
    let bank = rememberAnswer([], { questionId: 'notice_period', label: 'Notice period?', value: '30 days' });
    bank = rememberAnswer(bank, { questionId: 'notice_period', label: 'notice period', value: '60 days' });
    bank = rememberAnswer(bank, { questionId: 'notice_period', label: 'How soon can you join?', value: '60 days' });
    expect(bank).toHaveLength(1);
    expect(bank[0].value).toBe('60 days');
    expect(bank[0].aliases).toEqual(['Notice period?', 'How soon can you join?']);
  });

  it('creates a custom question for unknown labels', () => {
    expect(customId('What is your T-shirt size?')).toBe('custom:what-is-your-t-shirt-size');
    const bank = rememberAnswer([], { questionId: null, label: 'What is your T-shirt size?', value: 'M' });
    expect(bank[0].questionId).toBe('custom:what-is-your-t-shirt-size');
  });
});
