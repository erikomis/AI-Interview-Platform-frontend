"use server";

import { z } from "zod";
import { authApi } from "@/services/auth";
import { getTranslations } from "next-intl/server";

const schema = z.object({
  email: z.string().email(),
});

export type ForgotPasswordState = {
  status: "idle" | "success" | "error";
  email?: string;
  message?: string;
};

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const t = await getTranslations("forgotPassword");
  const raw = { email: formData.get("email") as string };
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    return { status: "error", message: t("invalidEmail") };
  }

  const email = parsed.data.email.toLowerCase();

  try {
    await authApi.forgotPassword(email);
  } catch {
    // Always show success to avoid email enumeration
  }

  return { status: "success", email };
}
