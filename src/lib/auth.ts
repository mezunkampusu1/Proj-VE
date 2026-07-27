import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validations";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // PrismaAdapter, ileride eklenebilecek OAuth sağlayıcıları için kullanıcı/
  // hesap kayıtlarını yönetir. Credentials sağlayıcısı JWT oturum stratejisi
  // gerektirdiğinden aşağıda session.strategy "jwt" olarak ayarlanmıştır.
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  // Docker/reverse proxy arkasında self-hosted çalışırken Auth.js, gelen
  // isteğin Host başlığını varsayılan olarak güvenilmez sayar. Uygulama
  // yalnızca kendi docker-compose ağımızda çalıştığından bu başlığa
  // güvenmek güvenlidir.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;

        const isValid = await verifyPassword(password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
