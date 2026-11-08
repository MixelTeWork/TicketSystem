import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { audienceName, useHelpArticle, useHelpCatalog, useHelpReleases, useHelpSearch, type HelpAudience } from "../../api/help";
import { ApiError } from "../../api/dataTypes";
import Layout from "../../components/Layout";
import Spinner from "../../components/Spinner";
import { EmptyState, PageHeading } from "../../components/Page";
import displayError from "../../utils/displayError";
import { calendarDate } from "../../utils/multiday";
import { useTitle } from "../../utils/useTitle";
import styles from "./styles.module.css";

const HelpMarkdown = lazy(() => import("../../components/HelpMarkdown"));

export default function HelpPage()
{
	useTitle("Инструкция");
	const catalog = useHelpCatalog();
	const catalogData = catalog.data;
	const search = useHelpSearch();
	const [query, setQuery] = useState("");
	const searching = search.status != "idle";
	return <Layout backLink="/" className={styles.root}>
		<PageHeading title="Инструкция" description="Выберите задачу или найдите нужную статью." />
		<form className={styles.search} onSubmit={event =>
		{
			event.preventDefault();
			if (!search.isPending && query.trim().length >= 2) search.mutate(query.trim());
		}}>
			<label htmlFor="help-search">Поиск по инструкции</label>
			<div className={styles.searchControls}><input id="help-search" type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={160} placeholder="Например, ручной ввод" />
				<button className="button button_primary" disabled={search.isPending || query.trim().length < 2}>Найти</button>
				{searching && <button className="button" type="button" disabled={search.isPending} onClick={() => { search.reset(); setQuery(""); }}>Все статьи</button>}</div>
		</form>
		{search.isPending && <Spinner />}{displayError(search)}
		{search.isSuccess && <section aria-live="polite">
			<h2>Результаты по запросу «{search.variables}»</h2>
			{search.data.total == 0 ? <EmptyState>Ничего не найдено. Попробуйте другие слова.</EmptyState> : <>
				<p className="muted">Найдено: {search.data.total}{search.data.total > search.data.items.length && `. Показаны первые ${search.data.items.length}; уточните запрос.`}</p>
				<ul className={styles.results}>{search.data.items.map(article => <li key={article.id}>
					<Link to={`/help/${article.id}`}>{article.title}</Link><span className={styles.audience}>{audienceName(article.audience)}</span>
					<p>{article.snippet}</p>
				</li>)}</ul>
			</>}
		</section>}
		{!searching && <>
			{catalog.isFetching && <Spinner />}{displayError(catalog)}
			{catalogData && catalogData.audiences.map(audience => <section key={audience} className={styles.catalog}>
				<h2>{audienceName(audience)}</h2>
				{catalogData.sections.map(section =>
				{
					const articles = catalogData.articles.filter(article => article.audience == audience && article.section == section.id);
					return articles.length > 0 && <div key={section.id}><h3>{section.title}</h3><ul>{articles.map(article => <li key={article.id}><Link to={`/help/${article.id}`}>{article.title}</Link></li>)}</ul></div>;
				})}
			</section>)}
		</>}
	</Layout>;
}

export function HelpArticlePage()
{
	const { articleId = "" } = useParams();
	const article = useHelpArticle(articleId);
	const heading = useRef<HTMLHeadingElement>(null);
	useTitle(article.data?.title || "Инструкция");
	useEffect(() => { if (article.isSuccess) heading.current?.focus(); }, [articleId, article.isSuccess]);
	return <Layout backLink="/help" className={styles.root}>
		{article.isFetching && <Spinner />}
		{article.error instanceof ApiError && article.error.status == 404 ? <p role="alert">Статья не найдена или недоступна вашей учётной записи.</p> : displayError(article)}
		{article.data && <article>
			<h1 ref={heading} tabIndex={-1} className={styles.articleTitle}>{article.data.title}</h1>
			<p className={styles.audience}>{audienceName(article.data.audience)}</p>
			<Suspense fallback={<Spinner />}><HelpMarkdown articleId={articleId} markdown={article.data.markdown} /></Suspense>
		</article>}
		<Link to="/help">К списку статей</Link>
	</Layout>;
}

export function WhatsNewPage()
{
	useTitle("Что нового");
	const releases = useHelpReleases();
	const { releaseId } = useParams();
	const selected = releases.data?.filter(release => !releaseId || release.id == releaseId);
	return <Layout backLink={releaseId ? "/whats-new" : "/"} className={styles.root}>
		<PageHeading title="Что нового" description="Возможности системы и изменения порядка работы." />
		{releases.isFetching && <Spinner />}{displayError(releases)}
		{selected?.length == 0 && <EmptyState>Выпуск не найден или недоступен вашей учётной записи.</EmptyState>}
		{selected?.map(release => <article key={release.id} id={release.id} className={styles.release}>
			<h2><Link to={`/whats-new/${release.id}`}>{release.title}</Link></h2>
			<p className={styles.audience}>{release.status == "upcoming" ? "Готовится к выпуску · дата ещё не назначена" : release.date ? `${release.approximateDate ? "Около " : ""}${calendarDate(release.date, true)}${release.approximateDate ? " · дата восстановлена по истории изменений" : ""}` : "Дата не указана"}{release.version && ` · ${release.version}`}</p>
			{(["organizers", "staff"] as HelpAudience[]).map(audience =>
			{
				const items = release.items.filter(item => item.audience == audience);
				return items.length > 0 && <section key={audience}><h3>{audienceName(audience)}</h3>
					{items.map(item => <div key={item.id} className={styles.releaseItem}><h4>{item.title}</h4><p>{item.text}</p>{item.articleId && <Link to={`/help/${item.articleId}`}>Как это работает</Link>}</div>)}
				</section>;
			})}
		</article>)}
	</Layout>;
}
