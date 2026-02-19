interface ShareButtonsProps {
    title: string;
    text: string;
    url: string;
}

export function ShareButtons({ title, text, url }: ShareButtonsProps) {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;

    function copyLink() {
        void navigator.clipboard.writeText(url).then(() => {
            alert('Link kopiert!');
        });
    }

    return (
        <div className="share-buttons">
            <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="share-btn share-btn--twitter"
                title="Auf X/Twitter teilen"
            >
                𝕏 Teilen
            </a>
            <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="share-btn share-btn--whatsapp"
                title="Per WhatsApp teilen"
            >
                💬 WhatsApp
            </a>
            <button
                onClick={copyLink}
                className="share-btn share-btn--copy"
                title="Link kopieren"
            >
                🔗 Link kopieren
            </button>
        </div>
    );
}
