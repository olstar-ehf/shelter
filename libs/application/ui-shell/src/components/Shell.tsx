/**
 * Shared page chrome (topbar + footer + language switcher), now rendered
 * by React for every page. The language links keep the current path and
 * only swap ?lang=.
 */
import { useEffect } from 'react';
import { useIntl } from 'react-intl';

export interface ShellProps {
  /** identity -> user + "signed in" chip; 'portal' -> portal session note. */
  session: 'identity' | 'portal' | 'none';
  identity?: { fullName: string; kennitala: string };
  /** Page title shown in the browser tab (localized by the caller). */
  title?: string;
  /** Message id of the page title (preferred over the literal title). */
  titleId?: string;
  children: React.ReactNode;
}

export function Shell({ session, identity, title, titleId, children }: ShellProps) {
  const intl = useIntl();
  const f = (id: string): string => intl.formatMessage({ id });
  const is = intl.locale === 'is';

  useEffect(() => {
    document.title = titleId ? f(titleId) : (title ?? f('schemeName'));
  }, [title, titleId, intl.locale]);

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner">
          <div>
            <span className="topbar-brand">{f('agencyName')}</span>
            <span className="topbar-title">{f('schemeName')}</span>
          </div>
          <div className="topbar-session">
            {session === 'identity' && identity && (
              <>
                <span className="session-user">
                  {identity.fullName}{' '}
                  <span className="session-kennitala">
                    (kt. {identity.kennitala})
                  </span>
                </span>
                <span className="chip chip-ok">{f('signedIn')}</span>
              </>
            )}
            {session === 'portal' && (
              <span className="muted-inverse">{f('portalSession')}</span>
            )}
            <span className="lang-switch" aria-label={f('languageLabel')}>
              <a href="?lang=is" className={is ? 'lang-active' : ''}>
                Íslenska
              </a>
              <span className="lang-sep">|</span>
              <a href="?lang=en" className={!is ? 'lang-active' : ''}>
                English
              </a>
            </span>
          </div>
        </div>
      </header>

      <main className="container">{children}</main>

      <footer className="app-footer">
        <div className="container">
          <p>{f('footerPrototype')}</p>
        </div>
      </footer>
    </div>
  );
}
