export const metadata = {
  title: "Dashboard",
  description: "Protected dashboard area",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
