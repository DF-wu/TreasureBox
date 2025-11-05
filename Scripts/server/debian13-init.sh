#!/bin/bash

# =================================================================
# Debian 13 (Trixie) 初始化腳本
#
# 這個腳本會自動化以下設定：
# 1. 設定 APT 軟體來源，啟用 non-free 和 contrib。
# 2. 更新系統並安裝常用的核心工具。
# 3. 安裝 Docker 及其相關工具。
# 4. 安裝 Cockpit Web 管理介面。
# 5. 安裝與設定 Zsh, Oh My Zsh 及自訂別名。
# 6. 啟用 Google BBR 擁塞控制演算法以優化網路。
# =================================================================

# 腳本開始，設定輸出顏色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}[INFO]${NC} Debian 13 初始化腳本即將開始..."
echo

# 步驟 1: 檢查 root 權限
echo -e "${BLUE}[INFO]${NC} 正在檢查是否以 root 使用者身份執行..."
if [ "$(id -u)" -ne 0 ]; then
  echo -e "${YELLOW}錯誤：此腳本必須以 root 權限執行。${NC}" >&2
  exit 1
fi
echo -e "${GREEN}[OK]${NC} 權限檢查通過。"
echo

# 步驟 2: 設定錯誤即離開
# set -e 會讓腳本在任何指令返回非零值時立即停止執行。
set -e

# 步驟 3: 設定 APT 軟體來源
echo -e "${YELLOW}[STEP 1/7]${NC} 設定 APT 軟體來源..."
echo -e "${BLUE}[INFO]${NC} 為了能夠安裝非自由軟體（如特定驅動），我們將啟用 'contrib' 和 'non-free' 元件。"
sed -i 's/main/main contrib non-free/g' /etc/apt/sources.list
echo -e "${GREEN}[OK]${NC} /etc/apt/sources.list 已更新，已啟用 'contrib' 和 'non-free'。"
echo

# 步驟 4: 更新系統並安裝核心套件
echo -e "${YELLOW}[STEP 2/7]${NC} 更新系統並安裝核心套件..."
apt update

# 定義要安裝的套件列表
CORE_PACKAGES="sudo curl wget git build-essential dkms neovim  zsh tmux htop iotop iftop bmon smartmontools lm-sensors rclone   speedtest-cli iperf3  lsd"

echo -e "${BLUE}[INFO]${NC} 即將安裝以下核心套件："
echo -e "${CORE_PACKAGES}"
apt upgrade -y
apt install -y ${CORE_PACKAGES}
echo -e "${GREEN}[OK]${NC} 系統更新與核心套件安裝完成。"
echo

# 步驟 5: 安裝 Docker
echo -e "${YELLOW}[STEP 3/7]${NC} 安裝 Docker..."
echo -e "${BLUE}[INFO]${NC} 新增 Docker 的官方 GPG 金鑰以驗證軟體包完整性。"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo -e "${BLUE}[INFO]${NC} 新增 Docker 的軟體源到 APT 來源列表。"
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update

# 定義要安裝的 Docker 套件
DOCKER_PACKAGES="docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"
echo -e "${BLUE}[INFO]${NC} 即將安裝以下 Docker 套件："
echo -e "${DOCKER_PACKAGES}"
apt install -y ${DOCKER_PACKAGES}
echo -e "${GREEN}[OK]${NC} Docker 安裝完成。"
echo

# 步驟 6: 安裝 Cockpit
echo -e "${YELLOW}[STEP 4/7]${NC} 安裝 Cockpit Web 管理介面..."
# 定義要安裝的 Cockpit 套件
COCKPIT_PACKAGES="cockpit cockpit-storaged cockpit-machines cockpit-podman cockpit-pcp"
echo -e "${BLUE}[INFO]${NC} 即將安裝以下 Cockpit 套件："
echo -e "${COCKPIT_PACKAGES}"
apt install -y ${COCKPIT_PACKAGES}
echo -e "${GREEN}[OK]${NC} Cockpit 安裝完成。"
echo

# 步驟 7: 安裝與設定 Oh My Zsh
echo -e "${YELLOW}[STEP 5/7]${NC} 安裝與設定 Oh My Zsh..."
echo -e "${BLUE}[INFO]${NC} 正在為 root 使用者安裝 Oh My Zsh..."
if [ -d "/root/.oh-my-zsh" ]; then
    echo -e "${BLUE}[INFO]${NC} Oh My Zsh 已安裝，略過安裝步驟。"
else
    # 使用 --unattended 參數進行非互動式安裝
    sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
fi

echo -e "${BLUE}[INFO]${NC} 正在設定 root 使用者的預設 Shell 為 Zsh..."
chsh -s $(which zsh) root

echo -e "${BLUE}[INFO]${NC} 正在為 Oh My Zsh 啟用 'docker' 外掛..."
# 檢查 .zshrc 是否存在，Oh My Zsh 安裝後應該會自動建立
if [ -f "/root/.zshrc" ]; then
    sed -i 's/^plugins=(git)$/plugins=(git docker)/' /root/.zshrc
else
    echo -e "${YELLOW}警告：找不到 /root/.zshrc 檔案，無法設定外掛。${NC}"
fi

echo -e "${BLUE}[INFO]${NC} 正在新增自訂別名到 /root/.zshrc..."
cat <<'EOF' >> /root/.zshrc

# Custom Aliases
# --- lsd aliases ---
alias ls='lsd'
alias ll='ls -l'
alias la='ls -a'
alias lla='ls -la'
alias lt='ls --tree'

# --- Other tools ---
# For gemini-cli, ensure GEMINI_API_KEY is set in your environment
alias gemini='GOOGLE_GEMINI_BASE_URL="https://edgeapi.hinetlove.site" gemini'
EOF
echo -e "${GREEN}[OK]${NC} Oh My Zsh 安裝與設定完成。"
echo

# 步驟 8: 啟用 TCP BBR
echo -e "${YELLOW}[STEP 6/7]${NC} 啟用 TCP BBR..."
echo -e "${BLUE}[INFO]${NC} BBR 是 Google 開發的擁塞控制演算法，可以顯著提高伺服器的網路吞吐量和延遲表現。"
echo "net.core.default_qdisc=fq" >> /etc/sysctl.conf
echo "net.ipv4.tcp_congestion_control=bbr" >> /etc/sysctl.conf
sysctl -p
echo -e "${GREEN}[OK]${NC} TCP BBR 已啟用。設定已寫入 /etc/sysctl.conf。"
echo

# 步驟 9: 完成訊息
echo -e "${YELLOW}[STEP 7/7]${NC} ✅ 初始化完成！"
echo -e "${GREEN}Debian 13 初始化腳本已成功執行完畢。${NC}"
echo -e "${BLUE}建議重新啟動系統以確保所有變更（特別是核心相關設定）完全生效。${NC}"
echo