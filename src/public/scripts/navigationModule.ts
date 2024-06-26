import connect from "./start.js";
import setupChat from "./chat.js";
import setupErrorPage from "./error.js";

interface Page {
    path: string;
    href: string;
    content: string;
}

interface NavigationModule {
    pages: Page[];
    loadPage: (href: string, pushToHistory: boolean) => void;
    fetchPage: (href: string, pageName: string) => Promise<Number>;
    init: () => void;
}

const navigationModule: NavigationModule = {
    pages: [],
    loadPage: function (href, pushToHistory) {
        const mainSection = document.querySelector('main');
        const wantedPage = this.pages.find((page: Page) => page.href === href);
        if (wantedPage && mainSection) {
            mainSection.innerHTML = wantedPage.content;
            if (pushToHistory)
                window.history.pushState({}, '', wantedPage.href);
        } else {
            if (mainSection)
                mainSection.innerHTML = '<h1>404 - Page not found</h1>';
            else
                console.error('Main section not found');
        }

        if (href === '/') {
            const onMatch = () => this.loadPage('/chat', false);
            const onError = () => this.loadPage('/error', false);
            connect(onMatch, onError);
        } else if (href === '/chat') {
            const onDisconnect = () => this.loadPage('/', false);
            const onSkip = () => this.loadPage('/chat', false);
            const onError = () => this.loadPage('/error', false);
            setupChat(onDisconnect, onSkip, onError);
        } else if (href === '/error') {
            const onGoBack = () => this.loadPage('/', false);
            setupErrorPage(onGoBack);
        }

    },
    fetchPage: function (path, href) {
        return fetch(path)
            .then(response => response.text())
            .then(content => this.pages.push({ path: path, href: href, content: content }));
    },
    init: function () {
        return Promise.all([
            this.fetchPage('/html/start.html', '/'),
            this.fetchPage('/html/chat.html', '/chat'),
            this.fetchPage('/html/error.html', '/error')
        ]).then(() => {
            this.loadPage(window.location.pathname, false);
            window.addEventListener('popstate', () => this.loadPage(window.location.pathname, false));
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    navigationModule.init();
});
