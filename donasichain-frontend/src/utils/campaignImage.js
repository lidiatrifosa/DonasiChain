const CAMPAIGN_IMAGES = [
  {
    keywords: ['pendidikan', 'sekolah', 'buku', 'beasiswa', 'belajar', 'mahasiswa'],
    image: '/campaign-images/education.jpg',
  },
  {
    keywords: ['anak', 'panti', 'yatim', 'balita', 'kekerasan'],
    image: '/campaign-images/children.jpg',
  },
  {
    keywords: ['kesehatan', 'medis', 'rumah sakit', 'operasi', 'pengobatan', 'sakit', 'dokter'],
    image: '/campaign-images/medical.jpg',
  },
  {
    keywords: ['bencana', 'banjir', 'gempa', 'korban', 'tanggap darurat', 'pengungsian'],
    image: '/campaign-images/disaster.jpg',
  },
  {
    keywords: ['lingkungan', 'hutan', 'laut', 'pantai', 'sungai', 'alam', 'sampah'],
    image: '/campaign-images/environment.jpg',
  },
];

export function getCampaignImage(campaign) {
  if (campaign?.image_url) return campaign.image_url;

  const text = `${campaign?.title || ''} ${campaign?.description || ''}`.toLowerCase();
  const match = CAMPAIGN_IMAGES.find(({ keywords }) =>
    keywords.some((keyword) => text.includes(keyword)),
  );

  return match?.image || '/campaign-images/community.jpg';
}

export function useCampaignImageFallback(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = '/campaign-images/community.jpg';
}
