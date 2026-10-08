import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
	const envDir = process.env.MARS_ENV_DIR || process.cwd();
	const env = loadEnv(mode, envDir, "");

	return {
		base: process.env.BASE_PATH || env.BASE_PATH || "/",
		envDir,
		plugins: [react(), tailwindcss(), {
			name: "static-account-route-entries",
			enforce: "post",
			generateBundle(_options, bundle) {
				const index = bundle["index.html"];
				if (index?.type === "asset") {
					for (const route of ["auth/login", "account"]) {
						this.emitFile({ type: "asset", fileName: `${route}/index.html`, source: index.source });
					}
				}
			},
		}],
		server: {
			proxy: {
				"/api/mcstatus": {
					target: "https://api.mcstatus.io",
					changeOrigin: true,
					rewrite: (path) =>
						path.replace(
							/^\/api\/mcstatus/,
							"/v2/status/java",
						),
				},
			},
		},
	};
});
