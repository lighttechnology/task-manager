import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { createServerClient } from "@/lib/supabase/server";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.events",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const supabase = createServerClient();
        await supabase.from("users").upsert(
          {
            email: user.email!,
            name: user.name,
            avatar_url: user.image,
            google_access_token: account.access_token,
            google_refresh_token: account.refresh_token,
          },
          { onConflict: "email" }
        );
      }
      return true;
    },
    async jwt({ token, account }) {
      if (account) {
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = account.expires_at;
      }

      // Refresh token if expired
      if (token.expires_at && Date.now() >= (token.expires_at as number) * 1000) {
        try {
          const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: "refresh_token",
              refresh_token: token.refresh_token as string,
            }),
          });
          const tokens = await response.json();

          if (!response.ok) throw tokens;

          token.access_token = tokens.access_token;
          token.expires_at = Math.floor(Date.now() / 1000 + tokens.expires_in);

          // Update Supabase
          const supabase = createServerClient();
          await supabase
            .from("users")
            .update({ google_access_token: tokens.access_token })
            .eq("email", token.email!);
        } catch {
          token.error = "RefreshAccessTokenError";
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.access_token = token.access_token as string;
      session.error = token.error as string | undefined;

      // Attach user ID from Supabase
      const supabase = createServerClient();
      const { data } = await supabase
        .from("users")
        .select("id")
        .eq("email", session.user.email!)
        .single();
      if (data) {
        session.user.id = data.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
});

// Extend types
declare module "next-auth" {
  interface Session {
    access_token?: string;
    error?: string;
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
