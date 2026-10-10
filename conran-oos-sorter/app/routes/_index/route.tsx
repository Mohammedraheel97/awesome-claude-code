import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Out-of-Stock Sorter</h1>
        <p className={styles.text}>
          Keeps out-of-stock products at the bottom of every collection for The Conran Shop.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Automatic</strong>. Stock changes are picked up within a minute and every collection is
            re-checked on a schedule.
          </li>
          <li>
            <strong>Keeps your merchandising</strong>. Manual collections keep their order, and restocked
            products go back where they were.
          </li>
          <li>
            <strong>Safe to try</strong>. Starts in preview mode, so you can see every planned move before
            anything changes.
          </li>
        </ul>
      </div>
    </div>
  );
}
