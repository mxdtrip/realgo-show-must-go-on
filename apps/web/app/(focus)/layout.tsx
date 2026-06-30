export default function FocusLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="focus-space">{children}</div>;
}
