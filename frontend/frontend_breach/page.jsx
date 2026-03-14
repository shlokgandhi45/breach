
import AppShell from '@/components/layout/AppShell';
import StatCards from '@/components/dashboard/StatCards';
import PipelineFlow from '@/components/dashboard/PipelineFlow';
import AIRecommendations from '@/components/dashboard/AIRecommendations';
import UpcomingInterviews from '@/components/dashboard/UpcomingInterviews';

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard" subtitle="Good morning, Priya 👋">
      <StatCards />
      <PipelineFlow />
      <div className="grid grid-cols-2 gap-5">
        <AIRecommendations />
        <UpcomingInterviews />
      </div>
    </AppShell>
  );
}
