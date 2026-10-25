import test from 'node:test';
import assert from 'node:assert/strict';
import {journalParagraphs} from '../lib/ui/journal-prose.ts';

test('technical notes become short paragraphs without changing punctuation, names or values',()=>{
  const text='配置 STM32CubeIDE 2.2.0，创建 LED_Blink 工程。练习 HAL_GPIO_WritePin()；测试 PA5。';
  assert.deepEqual(journalParagraphs(text),['配置 STM32CubeIDE 2.2.0，创建 LED_Blink 工程。','练习 HAL_GPIO_WritePin()；','测试 PA5。']);
});

test('source characters, whitespace, scores and literal HTML round trip exactly',()=>{
  for(const text of ['', '成绩 1/3 → 3/3。','原文\n保留空行\n\n和  两个空格。','<script>alert()</script> & `HAL_Delay()`','第一段。\n\n第二段；  最后。']){
    assert.equal(journalParagraphs(text).join(''),text);
    assert.ok(journalParagraphs(text).every(paragraph=>paragraph.length>0));
  }
});
test('closing quotation marks remain with their original sentence',()=>{
  assert.deepEqual(journalParagraphs('记录“先理解。”再动手。'),['记录“先理解。”','再动手。']);
});
test('text without Chinese sentence punctuation stays intact',()=>{
  assert.deepEqual(journalParagraphs('Long_identifier_ and 2.2.0'),['Long_identifier_ and 2.2.0']);
});
