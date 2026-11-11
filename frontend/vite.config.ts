import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import browserslistToEsbuild from "browserslist-to-esbuild";
import { execFileSync } from "node:child_process";

const configDirectory = new URL(".", import.meta.url);

function getCommitHash()
{
	let revision = process.env.BUILD_COMMIT || process.env.GITHUB_SHA;
	if (!revision)
	{
		try
		{
			revision = execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: configDirectory, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000,
			}).trim();
		}
		catch { return ""; }
	}
	if (!/^[\da-f]{7,64}$/i.test(revision)) throw new Error("BUILD_COMMIT/GITHUB_SHA must be a Git commit hash");
	return revision.slice(0, 7).toLowerCase();
}

const builtAt = new Date().toISOString();
const revision = getCommitHash();
const buildVersion = `${builtAt.slice(0, 10).replaceAll("-", ".")}.${builtAt.slice(11, 16).replaceAll(":", "")}${revision ? `+${revision}` : ""}`;

export default defineConfig({
	plugins: [react()],
	define: { "import.meta.env.VITE_BUILD_VERSION": JSON.stringify(buildVersion) },
	css: { postcss: { plugins: [autoprefixer()] } },
	server: {
		proxy: { "/api": "http://127.0.0.1:5001" },
	},
	build: {
		outDir: "build",
		assetsDir: "static",
		target: browserslistToEsbuild(undefined, { env: "production" }),
	},
	test: {
		environment: "jsdom",
		maxWorkers: 2,
	},
});
