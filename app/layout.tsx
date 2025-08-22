// Este layout se ejecuta antes del middleware y no debe tener providers
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
