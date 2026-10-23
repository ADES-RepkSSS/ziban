import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { useRoute, navigate, type Route } from './router';
import { HomePage } from '../features/home/HomePage';
import { WelcomePage } from '../features/welcome/WelcomePage';
import { LearnPage } from '../features/learn/LearnPage';
import { LibraryPage } from '../features/library/LibraryPage';
import { CardPage } from '../features/card/CardPage';
import { HelperPage } from '../features/helper/HelperPage';
import { ReaderPage } from '../features/reader/ReaderPage';
import { LookupPage } from '../features/lookup/LookupPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { BigButton } from '../components/BigButton';
import { Icon } from '../components/Icon';

const TITLES: Record<Route['name'], string> = {
  home: '字伴 · 按一下，字就会说话',
  welcome: '先认识一下 · 字伴',
  learn: '认字 · 字伴',
  library: '字库 · 字伴',
  card: '看字 · 字伴',
  helper: '帮我看屏幕 · 字伴',
  lookup: '看字 · 字伴',
  reader: '读文章 · 字伴',
  settings: '设置 · 字伴',
};

export default function App() {
  const route = useRoute();
  const routeKey =
    route.name === 'card' || route.name === 'reader' ? `${route.name}:${route.id}` : route.name;

  useEffect(() => {
    document.title = TITLES[route.name];
  }, [route.name]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [routeKey]);

  return (
    <AppErrorBoundary>
      <Page route={route} />
    </AppErrorBoundary>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'welcome':
      return <WelcomePage />;
    case 'learn':
      return <LearnPage />;
    case 'library':
      return <LibraryPage />;
    case 'card':
      return <CardPage id={route.id} />;
    case 'helper':
      return <HelperPage />;
    case 'lookup':
      return <LookupPage />;
    case 'reader':
      return <ReaderPage id={route.id} />;
    case 'settings':
      return <SettingsPage />;
    case 'home':
    default:
      return <HomePage />;
  }
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('字伴页面出错', error, info.componentStack);
  }

  override render() {
    if (this.state.failed) {
      return (
        <div className="crash">
          <span className="crash__icon" aria-hidden="true">
            <Icon name="info" size={60} />
          </span>
          <h1>页面打了个嗝</h1>
          <p>不怪你。点下面，回到开头再试一次。</p>
          <BigButton
            variant="primary"
            icon="home"
            onClick={() => {
              this.setState({ failed: false });
              navigate('#/');
            }}
          >
            回首页
          </BigButton>
          <button
            type="button"
            className="text-tool"
            onClick={() => {
              this.setState({ failed: false });
              window.location.reload();
            }}
          >
            重新打开
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
