import { userInfo } from "os";

export function hello(): void {
  const username = userInfo().username;
  console.log(`hello ${username}`);
}
