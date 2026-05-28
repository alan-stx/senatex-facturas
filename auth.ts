import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

function getAllowedEmails() {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],

  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();

      if (!email) return false;

      const allowedEmails = getAllowedEmails();

      if (allowedEmails.length === 0) {
        console.warn("[auth] ALLOWED_EMAILS está vacío. Nadie debería entrar en producción.");
        return false;
      }

      return allowedEmails.includes(email);
    },

    async session({ session }) {
      return session;
    },
  },
});