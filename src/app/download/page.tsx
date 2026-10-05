import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownToLine, ArrowRight, Mail, BarChart3, Layers } from "lucide-react";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Get the mobile app",
  description: "Download ReliantOutreach for Android. Your inbox, replies, statistics and plans in one place.",
};

const apk = "https://expo.dev/artifacts/eas/EQGq_h5L881Fm-kXqVEBjzMsVQ-rcTM9h-QCnunXKNw.apk";

export default function DownloadPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link href="/login" className={styles.brand}>
            <Image src="/android-chrome-192x192.png" width={40} height={40} alt="" />
            ReliantOutreach
          </Link>
          <Link href="/login" className={styles.portal}>Open portal <ArrowRight size={16} /></Link>
        </header>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <span className={styles.eyebrow}>YOUR WORKSPACE. WITH YOU.</span>
            <h1>Good conversations,<br />wherever you are<span>.</span></h1>
            <p>Keep up with replies, check your outreach performance and manage your plan from your phone.</p>
            <div className={styles.features}>
              <span><Mail size={17} /> Inbox &amp; replies</span>
              <span><BarChart3 size={17} /> Live stats</span>
              <span><Layers size={17} /> Plans &amp; requests</span>
            </div>
          </div>
          <div className={styles.card}>
            <Image src="/android-chrome-192x192.png" width={72} height={72} alt="ReliantOutreach app icon" className={styles.icon} />
            <h2>Get the Android app</h2>
            <p>Version 1.0.0 · Build 2 · Preview release</p>
            <a className={styles.download} href={apk}><ArrowDownToLine size={20} /> Download for Android</a>
            <ol>
              <li>Download the APK on your Android phone.</li>
              <li>Open the file and follow Android’s installation prompts.</li>
              <li>Sign in with your existing ReliantOutreach account.</li>
            </ol>
            <p className={styles.note}>New client? Accept your workspace invitation first. Each client signs in with their own account.</p>
            <div className={styles.ios}><strong>Using an iPhone?</strong><p>The iPhone app is not available yet. <Link href="/login">Use the mobile web portal <ArrowRight size={14} /></Link></p></div>
            <p className={styles.notice}>Background push notifications are not enabled in this preview. Open the app to check new replies.</p>
          </div>
        </section>
        <footer className={styles.footer}>Need help? <a href="mailto:info@reliantoutreach.com">info@reliantoutreach.com</a></footer>
      </div>
    </main>
  );
}
