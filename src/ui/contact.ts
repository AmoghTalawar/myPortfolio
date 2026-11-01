/* Contact form (POSTs JSON to the existing API), character counter and copy-email. */
import { $, toast } from "../core/dom";
import { sfx } from "../audio/sound";

const API_URL = "https://8zrznsk3a2.execute-api.ap-south-1.amazonaws.com/messages";
const EMAIL = "princeamogh7@gmail.com";

export function initContact() {
  const form = $<HTMLFormElement>("#contact-form");
  const ta = $<HTMLTextAreaElement>("#contact-form textarea");
  const countEl = $("#count");
  if (!form || !ta || !countEl) return;

  const updateCount = () => (countEl.textContent = ta.value.length + " / 1000");
  ta.addEventListener("input", updateCount);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("#form-status")!;
    const data = Object.fromEntries(new FormData(form));
    status.textContent = "Sending...";
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const out = await res.json();
      status.textContent = out.message;
      if (res.ok) {
        form.reset();
        updateCount();
        sfx.open();
      }
    } catch {
      status.textContent = "Something went wrong. Please try again.";
    }
  });

  $("#copy-mail")?.addEventListener("click", () => copyEmail());
}

export async function copyEmail() {
  try {
    await navigator.clipboard.writeText(EMAIL);
    toast("Email copied to clipboard");
    sfx.blip();
  } catch {
    toast(EMAIL);
  }
}
