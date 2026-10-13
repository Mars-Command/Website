// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createUISFX } from "uisfx";
import { SoundSettings } from "../components/SoundSettings";
import { SiteAudio } from "./siteAudio";

vi.mock("uisfx", () => ({ createUISFX: vi.fn() }));

describe("server-rendered sound safety", () => {
	it("imports and renders preferences without a browser or audio instantiation", () => {
		expect(typeof window).toBe("undefined");
		const service = new SiteAudio();
		service.initialize();
		const detach = service.attach();
		expect(service.playFromGesture("forward")).toBeNull();
		expect(service.playOutcome("success")).toBeNull();
		expect(renderToStaticMarkup(<SoundSettings />)).toContain(
			"Enable sound",
		);
		detach();
		expect(createUISFX).not.toHaveBeenCalled();
	});
});
