import { Link } from 'react-router-dom';
import styles from './CampaignCard.module.css';

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

function formatTanggal(dateStr) {
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

const STATUS_LABEL = {
  active: { label: 'Aktif', color: '#16a34a' },
  extended: { label: 'Diperpanjang', color: '#d97706' },
  target_reached: { label: 'Target Tercapai', color: '#2563eb' },
  released: { label: 'Dana Dicairkan', color: '#7c3aed' },
  ended: { label: 'Berakhir', color: '#6b7280' },
};

export default function CampaignCard({ campaign }) {
  const progress = Math.min((campaign.collected_amount / campaign.target_amount) * 100, 100);
  const deadline = campaign.extended_deadline || campaign.deadline;
  const status = STATUS_LABEL[campaign.status] || { label: campaign.status, color: '#6b7280' };

  return (
    <Link to={`/kampanye/${campaign.id}`} className={styles.card}>
      <div className={styles.imageWrapper}>
        {campaign.image_url ? (
          <img src={campaign.image_url} alt={campaign.title} className={styles.image} />
        ) : (
          <div className={styles.imagePlaceholder}>📷</div>
        )}
        <span className={styles.statusBadge} style={{ background: status.color }}>
          {status.label}
        </span>
      </div>
      <div className={styles.body}>
        <p className={styles.fundraiser}>{campaign.fundraiser_name}</p>
        <h3 className={styles.title}>{campaign.title}</h3>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.stats}>
          <div>
            <span className={styles.statValue}>{formatRupiah(campaign.collected_amount)}</span>
            <span className={styles.statLabel}>terkumpul dari {formatRupiah(campaign.target_amount)}</span>
          </div>
          <div className={styles.statRight}>
            <span className={styles.statValue}>{Math.round(progress)}%</span>
          </div>
        </div>
        <p className={styles.deadline}>⏰ Tenggat: {formatTanggal(deadline)}</p>
      </div>
    </Link>
  );
}
