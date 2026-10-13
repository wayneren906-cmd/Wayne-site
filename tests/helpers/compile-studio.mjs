import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const studioDir = path.join(projectRoot, 'app/studio');
const outDir = path.join(projectRoot, 'tests/.generated');

fs.mkdirSync(outDir, { recursive: true });

const files = [
  'studio-overview.tsx',
  'studio-event-list.tsx',
  'studio-event-detail.tsx',
  'studio-supplement-form.tsx',
  'studio-client.tsx',
];

export function compileAllStudioComponents() {
  for (const filename of files) {
    const srcPath = path.join(studioDir, filename);
    let code = fs.readFileSync(srcPath, 'utf8');

    // 剥离 Next.js / React client 指令
    code = code.replace('"use client";', '');

    // 路径映射：将 @/lib/learning/contracts 映射到相对 contracts.ts
    code = code.replaceAll('@/lib/learning/contracts', '../../../lib/learning/contracts.ts');

    // 将 ./studio-* 相对导入映射到 ./studio-*.mjs
    code = code.replace(/from\s+["'](\.\/studio-[a-z-]+)["']/g, 'from "$1.mjs"');

    // 使用 TypeScript 内置 transpileModule 处理 JSX 与 TS 类型
    const result = ts.transpileModule(code, {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
      },
    });

    let output = result.outputText;
    if (!output.includes("import React from 'react';") && !output.includes('import React from "react";')) {
      output = `import React from 'react';\n${output}`;
    }

    const outPath = path.join(outDir, filename.replace('.tsx', '.mjs'));
    fs.writeFileSync(outPath, output, 'utf8');
  }
}

// 支持直接运行编译
if (process.argv[1] === import.meta.filename) {
  compileAllStudioComponents();
  console.log('Successfully compiled all studio components to .ccg/tasks/g3-studio-verification/compiled/');
}
