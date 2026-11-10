import { useSuspenseQuery } from "@tanstack/react-query";
import { currentUserQuery, type CurrentUser } from "@/lib/queries";

/** Only use inside the signed-in area, where the layout has already loaded the user. */
export function useCurrentUser(): CurrentUser {
  const { data } = useSuspenseQuery(currentUserQuery());
  if (!data) throw new Error("Not signed in");
  return data;
}
