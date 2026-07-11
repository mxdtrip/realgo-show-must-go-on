import { getDictionary } from "../../_content/i18n";
import { DashboardClient } from "./_components/DashboardClient";

export default function DashboardPage() {
  const copy = getDictionary().cabinet;
  const page = copy.pages.dashboard;

  return (
    <DashboardClient
      copy={{
        eyebrow: page.eyebrow,
        title: page.title,
        description: page.description,
        queueTitle: page.queueTitle,
        queueEmpty: page.queueEmpty,
        patternsTitle: page.patternsTitle,
        patternsEmpty: page.patternsEmpty,
        loading: page.loading,
        errorTitle: page.errorTitle,
        retry: page.retry,
        viewAll: copy.common.viewAll,
        dayToday: page.dayToday,
        dayTomorrow: page.dayTomorrow,
        statTooltips: page.statTooltips,
        launcher: page.launcher,
        heatmap: page.heatmap,
        reviewTypes: copy.pages.reviews.types,
      }}
    />
  );
}
