import { Project, SourceFile, SyntaxKind, Node } from 'ts-morph';
import type { Edge, UsageType } from './types.js';

/**
 * Finds the nearest enclosing function/method/class name for a node,
 * so a usage can be attributed to "who is doing the calling", not just
 * "which file". Falls back to '' for top-level (module-scope) code.
 */
function getEnclosingSymbolName(node: Node): string {
  const fn = node.getFirstAncestor(
    (a) =>
      a.getKind() === SyntaxKind.FunctionDeclaration ||
      a.getKind() === SyntaxKind.MethodDeclaration ||
      a.getKind() === SyntaxKind.ArrowFunction ||
      a.getKind() === SyntaxKind.FunctionExpression
  );
  if (!fn) return '';

  if (Node.isFunctionDeclaration(fn) || Node.isMethodDeclaration(fn)) {
    return fn.getName() ?? '(anonymous)';
  }
  // Arrow function / function expression: try to grab the variable it's assigned to
  const varDecl = fn.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  return varDecl?.getName() ?? '(anonymous)';
}

function classifyUsage(node: Node): UsageType | null {
  const parent = node.getParent();
  if (!parent) return null;
  if (Node.isCallExpression(parent) && parent.getExpression() === node) return 'call';
  if (Node.isNewExpression(parent) && parent.getExpression() === node) return 'instantiation';
  return 'reference';
}

/**
 * Resolves a CommonJS require() specifier (e.g. './foo', '../lib/bar') to an
 * actual SourceFile already in the project. Node's require() resolution tries,
 * in order: exact match, +.js, +.jsx, +.ts, +.tsx, then an /index file of each.
 * Only handles relative specifiers — bare specifiers ('express') are external
 * packages and skipped, same as ES imports.
 */
function resolveRequireTarget(fromFile: SourceFile, specifier: string, project: Project): SourceFile | undefined {
  if (!specifier.startsWith('.')) return undefined; // external package

  const dir = fromFile.getDirectoryPath();
  const base = `${dir}/${specifier}`.replace(/\/\.\//g, '/');
  const candidates = [
    base,
    `${base}.js`, `${base}.jsx`, `${base}.ts`, `${base}.tsx`,
    `${base}/index.js`, `${base}/index.jsx`, `${base}/index.ts`, `${base}/index.tsx`,
  ];

  for (const candidate of candidates) {
    const found = project.getSourceFile((f) => f.getFilePath() === candidate);
    if (found) return found;
  }
  return undefined;
}

/** The names a require() call actually binds, given how its result is used. */
function getRequiredNames(callExpr: Node): string[] {
  const varDecl = callExpr.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (!varDecl) return []; // bare `require('./x')` with no binding — side-effect only, no symbol usage to trace

  const nameNode = varDecl.getNameNode();
  if (Node.isObjectBindingPattern(nameNode)) {
    // const { a, b } = require('./x')
    return nameNode.getElements().map((el) => el.getName());
  }
  // const x = require('./x')
  return [varDecl.getName()];
}

export function buildGraph(project: Project): { files: string[]; edges: Edge[] } {
  const edges: Edge[] = [];
  const sourceFiles = project.getSourceFiles();
  const files = sourceFiles.map((f) => f.getFilePath());

  for (const file of sourceFiles) {
    // --- ES module imports ---
    for (const importDecl of file.getImportDeclarations()) {
      const resolved = importDecl.getModuleSpecifierSourceFile();
      if (!resolved) continue; // external package (node_modules) — skip for now

      const namedImports = importDecl.getNamedImports().map((n) => n.getName());
      const defaultImport = importDecl.getDefaultImport()?.getText();
      const importedNames = [...namedImports, ...(defaultImport ? [defaultImport] : [])];

      for (const name of importedNames) {
        recordUsages(file, name, resolved, edges);
      }
    }

    // --- CommonJS require() calls ---
    file.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const expr = node.getExpression();
      if (!Node.isIdentifier(expr) || expr.getText() !== 'require') return;

      const args = node.getArguments();
      if (args.length !== 1 || !Node.isStringLiteral(args[0])) return;

      const specifier = args[0].getLiteralValue();
      const resolved = resolveRequireTarget(file, specifier, project);
      if (!resolved) return; // external package or unresolvable — skip

      const requiredNames = getRequiredNames(node);
      for (const name of requiredNames) {
        recordUsages(file, name, resolved, edges);
      }
    });
  }

  return { files, edges };
}

/** Finds every usage of `name` in `file` (excluding the import/require site itself) and records an edge for each. */
function recordUsages(file: SourceFile, name: string, resolved: SourceFile, edges: Edge[]): void {
  file.forEachDescendant((node) => {
    if (!Node.isIdentifier(node) || node.getText() !== name) return;
    // skip the import declaration / require call itself
    if (node.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)) return;
    const varDecl = node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    if (varDecl && varDecl.getInitializer()?.getText().includes('require(')) return;

    const usageType = classifyUsage(node);
    if (!usageType) return;

    edges.push({
      fromFile: file.getFilePath(),
      fromSymbol: getEnclosingSymbolName(node),
      toFile: resolved.getFilePath(),
      toSymbol: name,
      usageType,
      line: node.getStartLineNumber(),
    });
  });
}