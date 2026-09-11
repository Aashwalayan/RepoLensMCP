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

export function buildGraph(project: Project): { files: string[]; edges: Edge[] } {
  const edges: Edge[] = [];
  const sourceFiles = project.getSourceFiles();
  const files = sourceFiles.map((f) => f.getFilePath());

  for (const file of sourceFiles) {
    for (const importDecl of file.getImportDeclarations()) {
      const resolved = importDecl.getModuleSpecifierSourceFile();
      if (!resolved) continue; // external package (node_modules) — skip for now

      const namedImports = importDecl.getNamedImports().map((n) => n.getName());
      const defaultImport = importDecl.getDefaultImport()?.getText();
      const importedNames = [...namedImports, ...(defaultImport ? [defaultImport] : [])];

      for (const name of importedNames) {
        // Find every place this identifier is referenced in the importing file
        file.forEachDescendant((node) => {
          if (!Node.isIdentifier(node) || node.getText() !== name) return;
          // skip the import declaration itself
          if (node.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)) return;

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
    }
  }

  return { files, edges };
}