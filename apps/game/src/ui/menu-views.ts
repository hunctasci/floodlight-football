import { CITIES, getCity } from '../city-league/cities';
import { seasonCountdown, type CityLeagueResponse } from '../city-league/api';
import type { CityProfile } from '../city-league/profile';
import type { CityStanding } from '../city-league/standings';

/** All dynamic copy is escaped at the HTML boundary, including API data. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
const number = (value: number) => value.toLocaleString('en');
const signed = (value: number) => value > 0 ? `+${value}` : String(value);
const flag = (code: string, large = false) => `<span class="nation-flag${large ? ' nation-flag-large' : ''}" aria-hidden="true">${getCity(code)?.flag ?? ''}</span>`;
const tag = '<span class="your-tag">YOU</span>';

export function menuHeader(section: string, back = false): string {
  return `<header class="stadium-header"><div class="stadium-brand"><img src="/icons/hnc-retro-v2.png" width="48" height="48" alt="HNC League"><span>HNC LEAGUE<small>THE WORLD IS YOUR HOME GROUND</small></span></div>${back ? '<button type="button" class="menu-item netbtn text-button" data-act="city-back">← LOBBY</button>' : `<span class="section-label">${escapeHtml(section)}</span>`}</header>`;
}
export function menuFooter(): string {
  return `<footer class="stadium-footer"><span>RETRO FOOTBALL. REAL RIVALRIES.</span><a href="/how-to-play.html" target="_blank" rel="noopener">Rules & controls ↗</a></footer>`;
}

export function onboardingView(name: string, code: string, error: string, invite: boolean): string {
  return `${menuHeader('WELCOME TO THE LEAGUE')}
  <div class="onboarding-layout">
    <section class="onboarding-story"><div class="eyebrow">ONE GAME. TWO WAYS TO MAKE IT COUNT.</div><h1 class="stadium-title">YOUR COUNTRY.<br>YOUR FRIENDS.<br><em>YOUR GAME.</em></h1><p class="stadium-intro">Big football energy. Two-minute matches.<br>Go for national glory or settle it with a friend.</p>
      <div class="mode-explainer"><span class="mode-number">01</span><div><h2>PLAY FOR YOUR COUNTRY</h2><p>Control your national team. Win points together. Climb the weekly world table.</p></div></div>
      <div class="mode-explainer friend-explainer"><span class="mode-number">02</span><div><h2>CHALLENGE A FRIEND · 1V1</h2><p>Create an invite link, send it to a friend, and go head to head. Your teams. Your rivalry.</p></div></div>
      <div class="entry-facts"><span>FREE TO PLAY</span><span>NO DOWNLOAD</span><span>NO ACCOUNT NEEDED</span></div>
    </section>
    <section class="player-entry" aria-labelledby="entry-title">${invite ? '<div class="invite-notice" role="status">FRIEND INVITE RECEIVED<br><span>Pick your name and country to join their match.</span></div>' : '<div class="eyebrow">YOUR FIRST CALL-UP</div>'}<h2 id="entry-title">${invite ? 'JOIN YOUR FRIEND.' : 'MAKE IT YOURS.'}</h2><p class="entry-description">A name. A nation. You’re in.</p>
      <form id="onboard-form" novalidate>
        <label class="field-label" for="onboard-name">PLAYER NAME <span>3–16 characters</span></label>
        <input class="netcode" id="onboard-name" data-testid="onboard-name" type="text" maxlength="16" value="${escapeHtml(name)}" placeholder="PLAYER NAME" autocomplete="nickname" autocapitalize="words" spellcheck="false" aria-describedby="onboard-msg" ${error ? 'aria-invalid="true"' : ''}>
        <label class="field-label" for="onboard-country">REPRESENT YOUR COUNTRY</label>
        <select class="netcode" id="onboard-country" data-testid="onboard-country" aria-describedby="country-lock">${CITIES.map(c => `<option value="${c.code}" ${c.code === code ? 'selected' : ''}>${c.flag} ${escapeHtml(c.name)}</option>`).join('')}</select>
        <p id="country-lock" class="field-help">Your country stays with you for this weekly season. Choose your side.</p>
        <div id="onboard-msg" data-testid="onboard-msg" class="form-feedback" role="alert">${escapeHtml(error)}</div>
        <button type="submit" class="menu-item entry-submit" data-testid="onboard-continue">${invite ? 'JOIN FRIEND’S MATCH' : 'ENTER THE STADIUM'} <span aria-hidden="true">→</span></button>
        <p class="field-help entry-note">Your guest profile is saved on this browser.</p>
      </form>
      <div class="entry-ticket"><span>YOUR MATCHDAY TICKET</span><strong>2 MIN</strong><span>TWO 60-SECOND HALVES</span></div>
    </section>
  </div>${menuFooter()}`;
}

interface LeagueViewState {
  table: CityLeagueResponse | null;
  profile: CityProfile | null;
  busy: boolean;
  error: string;
}
function tableNotice({ table, busy, error }: LeagueViewState): string {
  if (error) return `<div class="table-notice" role="status">${table ? 'Showing the last available standings. ' : ''}Couldn’t update the table. <button type="button" class="menu-item netbtn text-button" data-act="city-refresh">TRY AGAIN</button></div>`;
  if (!table) return `<div class="table-placeholder" role="status">${busy ? 'Loading the world table…' : 'The world table is unavailable.'}<p>Your next match is still one tap away.</p></div>`;
  return '';
}
function miniRow(row: CityStanding, mine: string | undefined): string {
  return `<li class="mini-standing${row.cityCode === mine ? ' is-yours' : ''}"><span class="mini-rank">${row.rank}</span>${flag(row.cityCode)}<span class="mini-country">${escapeHtml(row.cityName)} ${row.cityCode === mine ? tag : ''}</span><strong>${number(row.points)}<small>PTS</small></strong></li>`;
}
export function lobbyView(state: LeagueViewState, menuIndex: number, status: string, touch: boolean): string {
  const { table, profile } = state;
  const country = profile ? getCity(profile.cityCode) : null;
  const mine = table?.standings.find(row => row.cityCode === profile?.cityCode);
  const ends = table ? seasonCountdown(Date.now(), table.season.endsAt) : 'Weekly season';
  const active = table?.standings.some(row => row.played > 0);
  return `${menuHeader('WORLD LOBBY')}
    <div class="lobby-heading"><div><div class="eyebrow">WELCOME TO MATCHDAY</div><h1 class="stadium-title">MAKE YOUR<br><em>COUNTRY PROUD.</em></h1><p class="stadium-intro">${escapeHtml(profile?.displayName)}, your country needs you.</p></div><div class="player-pass">${flag(country?.code ?? '', true)}<div><span>YOU REPRESENT</span><strong>${escapeHtml(country?.name ?? 'Your country')}</strong><small>${mine && mine.played ? '#' + mine.rank + ' IN THE WORLD' : 'YOUR NEXT MATCH MATTERS'}</small></div></div></div>
    <div class="lobby-layout"><section class="play-options" aria-label="Choose how to play">
      <button type="button" class="menu-item mode-card country-mode ${menuIndex === 0 ? 'selected' : ''}" data-mi="0" data-testid="find-match"><span class="mode-card-top"><span>01 / NATIONAL GLORY</span><span>2 MIN MATCH</span></span><strong>PLAY FOR<br>${escapeHtml(country?.name.toUpperCase() ?? 'YOUR COUNTRY')}</strong><span class="mode-description">Your team. Your flag. Points for your nation.</span><span class="mode-card-bottom">FIND AN OPPONENT <span aria-hidden="true">↗</span></span></button>
      <div class="friend-mode-wrap"><button type="button" class="menu-item mode-card friend-mode ${menuIndex === 1 ? 'selected' : ''}" data-mi="1" data-testid="challenge-friend"><span class="mode-card-top"><span>02 / FRIEND RIVALRIES</span><span>ONLINE 1V1</span></span><strong>PLAY WITH A FRIEND</strong><span class="mode-description">Send the link. Pick your sides. Settle it on the pitch.</span><span class="mode-card-bottom">CREATE AN INVITE <span aria-hidden="true">↗</span></span></button><div class="friend-code-line"><span>Already have an invite code?</span><button type="button" class="menu-item netbtn text-button" data-act="join-friend">JOIN WITH CODE →</button></div></div>
      ${status ? `<div class="form-feedback" role="status">${escapeHtml(status)}</div>` : ''}
      <p class="matchmaking-info">Computer-controlled opponents may fill empty searches. Verified matches also count toward country standings.</p>
    </section>
    <aside class="league-preview" aria-label="Weekly world standings"><div class="preview-heading"><div class="eyebrow">THE WEEKLY RACE</div><h2>WORLD TABLE</h2><span class="season-chip">${table ? 'ENDS IN ' : ''}${escapeHtml(ends)}</span></div>${tableNotice(state)}${table ? `${active ? '<div class="table-small-label"><span>COUNTRY</span><span>POINTS</span></div><ol class="mini-standings">' + table.standings.slice(0, 5).map(row => miniRow(row, profile?.cityCode)).join('') + '</ol>' : '<div class="table-placeholder"><strong>A NEW WEEK.<br>A LEVEL PLAYING FIELD.</strong><p>No results yet. Put your country on the board.</p></div>'}${mine ? `<div class="your-standing"><span class="table-small-label">YOUR COUNTRY</span><ol class="mini-standings">${miniRow(mine, profile?.cityCode)}</ol></div>` : ''}` : ''}
      <button type="button" class="menu-item table-link ${menuIndex === 2 ? 'selected' : ''}" data-mi="2" data-testid="world-table">VIEW FULL WORLD TABLE <span aria-hidden="true">→</span></button><div class="points-key"><span><b>+3</b> WIN</span><span><b>+1</b> DRAW</span><span>ONE SHARED RANK</span></div>
    </aside></div>
    <details class="lobby-help"><summary>THE MATCHDAY BRIEF · HOW TO PLAY</summary><div class="brief-grid"><p>Control your full national team through two 60-second halves. Verified results against another country earn league points—even when you invite a friend. Same-country matches are friendlies.</p><p>${touch ? 'Use the stick to move. PASS, LONG, SHOOT and SWITCH are your match controls.' : 'Arrow keys to move · S to pass · W/A for a long ball · D to shoot · Space to switch · Shift to sprint.'} Your country stays locked for the weekly season.</p></div></details>${menuFooter()}`;
}

export function filterStandings(rows: CityStanding[], query: string): CityStanding[] {
  const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en');
  const needle = normalized(query.trim());
  return rows.filter(row => normalized(row.cityName).includes(needle) || normalized(row.cityCode).includes(needle));
}
export function standingsRows(rows: CityStanding[], ownCode?: string): string {
  if (!rows.length) return '<tr><td colspan="8" class="table-empty">No countries found. Try a country name or two-letter code.</td></tr>';
  return rows.map(row => `<tr id="standing-${escapeHtml(row.cityCode)}" tabindex="-1" class="${row.cityCode === ownCode ? 'is-yours' : ''}"><td class="rank-cell">${row.rank}</td><th scope="row"><span class="table-nation">${flag(row.cityCode)}<span>${escapeHtml(row.cityName)}</span>${row.cityCode === ownCode ? tag : ''}</span></th><td>${number(row.played)}</td><td class="extra-stat">${number(row.wins)}</td><td class="extra-stat">${number(row.draws)}</td><td class="extra-stat">${number(row.losses)}</td><td class="gd-cell">${signed(row.goalDifference)}</td><td class="points-cell">${number(row.points)}</td></tr>`).join('');
}
export function leaderboardView(state: LeagueViewState, query: string): string {
  const { table, profile, busy } = state;
  const rows = table?.standings ?? [];
  const active = rows.some(row => row.played > 0);
  const mine = rows.find(row => row.cityCode === profile?.cityCode);
  const podium = active ? `<div class="leaders-podium" aria-label="Top three countries">${rows.slice(0, 3).map((row, i) => `<article class="leader-card leader-${i + 1}"><div class="leader-position">${i === 0 ? 'SETTING THE PACE' : 'IN THE CHASE'}<strong>0${i + 1}</strong></div>${flag(row.cityCode, true)}<h2>${escapeHtml(row.cityName)}</h2><div class="leader-points">${number(row.points)} <span>PTS</span></div><p>${number(row.wins)} WINS · ${number(row.played)} PLAYED</p>${row.cityCode === profile?.cityCode ? tag : ''}</article>`).join('')}</div>` : table ? '<div class="season-start"><div class="eyebrow">THE SEASON STARTS WITH YOU</div><h2>EVERY COUNTRY STARTS AT ZERO.</h2><p>No confirmed results yet. Play the first match and set the pace.</p></div>' : '';
  return `${menuHeader('WORLD TABLE', true)}<div class="leaderboard-heading"><div><div class="eyebrow">NATIONAL TEAMS. ONE SHARED AMBITION.</div><h1 class="stadium-title">THE <em>WORLD TABLE.</em></h1><p class="stadium-intro">Every player contributes. Every country has a chance.</p></div>${table ? `<span class="season-chip">${escapeHtml(table.season.key)}<br>ENDS IN ${escapeHtml(seasonCountdown(Date.now(), table.season.endsAt))}</span>` : ''}</div>${tableNotice(state)}${podium}
  ${mine ? `<section class="country-rally" aria-label="Your country’s standing">${flag(mine.cityCode)}<div><span class="eyebrow">YOUR COUNTRY · #${mine.rank}</span><strong>${escapeHtml(mine.cityName)}</strong><span>${number(mine.points)} points · ${number(mine.played)} matches</span></div><button type="button" class="menu-item netbtn rally-play" data-act="country-play">PLAY FOR YOUR COUNTRY →</button></section>` : ''}
  <section class="standings-section" aria-label="All country standings"><div class="standings-toolbar"><div class="standings-search"><label class="field-label" for="country-search">FIND A COUNTRY</label><input type="search" class="netcode" id="country-search" data-testid="country-search" placeholder="Country name or code" value="${escapeHtml(query)}" autocomplete="off"></div><button type="button" class="menu-item netbtn text-button" data-act="find-my-country" ${mine ? '' : 'disabled'}>MY COUNTRY ↓</button><button type="button" class="menu-item netbtn text-button" data-act="city-refresh" ${busy ? 'disabled' : ''}>${busy ? 'UPDATING…' : 'REFRESH ↻'}</button></div>
  <div id="standings-count" class="table-small-label" role="status">${filterStandings(rows, query).length} COUNTRIES</div><div class="standings-scroll"><table class="world-standings" data-testid="standings-table"><caption class="sr-only">Weekly country standings. Sorted by points, goal difference, goals scored, wins, then country code.</caption><thead><tr><th scope="col">#</th><th scope="col">COUNTRY</th><th scope="col"><abbr title="Played">P</abbr></th><th scope="col" class="extra-stat"><abbr title="Wins">W</abbr></th><th scope="col" class="extra-stat"><abbr title="Draws">D</abbr></th><th scope="col" class="extra-stat"><abbr title="Losses">L</abbr></th><th scope="col"><abbr title="Goal difference">GD</abbr></th><th scope="col"><abbr title="Points">PTS</abbr></th></tr></thead><tbody id="standings-body">${table ? standingsRows(filterStandings(rows, query), profile?.cityCode) : '<tr><td colspan="8" class="table-empty">Standings will appear here when available.</td></tr>'}</tbody></table></div>
  <p class="standings-note">WIN +3 · DRAW +1 · LOSS +0<br>Ties: goal difference, goals scored, wins, then country code. Only verified results between different countries count.</p></section>${menuFooter()}`;
}
