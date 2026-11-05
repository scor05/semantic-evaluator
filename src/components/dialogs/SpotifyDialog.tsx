import { useState } from "react"
import "./spotify.css"
import spotifyLogo from "../../assets/spotify.png"

export function SpotifyDialog() {
    var [openSpotify, setOpenSpotify] = useState(false);
    var spotifyActiveClass = `${openSpotify ? "active" : "inactive"}`
    var btnClass = `spotify-img spotify-img-${spotifyActiveClass}`
    var iframeClass = `spotify-player spotify-player-${spotifyActiveClass}`
    var modalClass = `spotify-modal spotify-modal-${spotifyActiveClass}`

    return (
        <div
            aria-label="Integración de Spotify"
            className={modalClass}
        >
            <button className="spotify-logo-btn" onClick={() => { setOpenSpotify(!openSpotify) }}>
                <img
                    className={btnClass}
                    src={spotifyLogo}
                />
            </button>

            <iframe
                className={iframeClass}
                aria-hidden={!openSpotify}
                tabIndex={openSpotify ? 0 : -1}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                src="https://open.spotify.com/embed/playlist/6p8zUfPf5MLEnnsJ598q62"
            />
        </div>
    )
}
