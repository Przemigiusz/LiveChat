export default function setupErrorPage(onGoBack: () => void): void {
    try {
        const goBackBtn = document.querySelector('.go-back') as HTMLButtonElement;
        if (!goBackBtn) throw new Error('Page content was not generated correctly.');
        goBackBtn.addEventListener('click', onGoBack);
    } catch (err) {
        console.error(err);
    }

}