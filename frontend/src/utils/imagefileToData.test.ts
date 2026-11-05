import { afterEach, expect, test, vi } from "vitest";
import imagefileToData from "./imagefileToData";

afterEach(() => vi.unstubAllGlobals());
test("returns an image with its mandatory event access", async () =>
{
	const result = await imagefileToData(new File(["image"], "image.png", { type: "image/png" }), "Background", 7);
	expect(result).toEqual({ name: "Background", accessEventId: 7, data: expect.stringMatching(/^data:image\/png;base64,/) });
});
test.each(["error", "abort", "load"])("rejects a failed or non-string FileReader result (%s)", async event =>
{
	class BrokenReader extends EventTarget
	{
		result = null;
		readAsDataURL() { this.dispatchEvent(new Event(event)); }
	}
	vi.stubGlobal("FileReader", BrokenReader);
	await expect(imagefileToData(new File(["image"], "image.png"), "Background", 7)).rejects.toThrow("Не удалось прочитать картинку");
});
