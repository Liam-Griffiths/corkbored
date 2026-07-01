import { requireUser } from "@/lib/authz";
import { apiError } from "@/lib/api";
import { deleteUserAccount } from "@/lib/account";

export async function DELETE() {
  try {
    const user = await requireUser();
    await deleteUserAccount(user.id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return apiError(e);
  }
}
