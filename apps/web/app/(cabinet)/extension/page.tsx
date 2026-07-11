import { getDictionary } from "../../_content/i18n";
import { ExtensionStatusClient } from "./_components/ExtensionStatusClient";

export default function ExtensionPage() {
  const page = getDictionary().cabinet.pages.extension;

  return <ExtensionStatusClient copy={page} />;
}
