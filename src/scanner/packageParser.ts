import fs from "node:fs";
import path from "node:path";

export interface PackageInfo {
  name?: string;
  description?: string;
  mainDependencies: string[];
  devDependencies: string[];
  detectedFramework?: string;
}

// Recognizable frameworks/tools inferred from dependency names.
const FRAMEWORK_SIGNALS: Record<string, string> = {
  next: "Next.js",
  react: "React",
  vue: "Vue",
  "@angular/core": "Angular",
  express: "Express",
  fastify: "Fastify",
  "@nestjs/core": "NestJS",
  "@modelcontextprotocol/sdk": "MCP Server",
  django: "Django",
  flask: "Flask",
};

export function parsePackageJson(rootDir: string): PackageInfo | null {
  const pkgPath = path.join(rootDir, "package.json");
  if (!fs.existsSync(pkgPath)) return null;

  const raw = fs.readFileSync(pkgPath, "utf-8");
  const pkg = JSON.parse(raw);

  const mainDependencies = Object.keys(pkg.dependencies ?? {});
  const devDependencies = Object.keys(pkg.devDependencies ?? {});

  let detectedFramework: string | undefined;
  for (const dep of mainDependencies) {
    if (FRAMEWORK_SIGNALS[dep]) {
      detectedFramework = FRAMEWORK_SIGNALS[dep];
      break;
    }
  }

  return {
    name: pkg.name,
    description: pkg.description,
    mainDependencies,
    devDependencies,
    detectedFramework,
  };
}