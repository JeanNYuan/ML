// WebGL背景代码
const canvas = document.getElementById("webgl-canvas");
const gl = canvas.getContext("webgl2");
document.body.style = "margin:0;touch-action:none;overflow:auto;"; // 修改为overflow:auto允许滚动
canvas.style.width = "100%";
canvas.style.height = "auto";
canvas.style.userSelect = "none";
const dpr = Math.max(1,.5 * window.devicePixelRatio);
window.onresize = resize;

const vertexSource = `#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
in vec4 position;
void main(void) {
gl_Position = position;
}
`;

const fragmentSource = `#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
out vec4 fragColor;
uniform vec2 resolution;
uniform float time;
uniform vec2 touch;
uniform int pointerCount;
#define mouse (touch/resolution)
#define P pointerCount
#define T (10.+time*.5)
#define S smoothstep
#define hue(a) (.6+.6*cos(6.3*(a)+vec3(0,23,21)))
mat2 rot(float a) {
float c = cos(a), s = sin(a);
return mat2(c, -s, s, c);
}
float orbit(vec2 p, float s) {
return floor(atan(p.x, p.y)*s+.5)/s;
}
void cam(inout vec3 p) {
// 自动旋转效果
float angleX = sin(time * 0.1) * 0.5;
float angleY = cos(time * 0.1) * 0.5;
p.yz *= rot(angleY);
p.xz *= rot(angleX);
}
void main(void) {
vec2 uv = (
gl_FragCoord.xy-.5*resolution
)/min(resolution.x, resolution.y);
vec3 col = vec3(0), p = vec3(0),
rd = normalize(vec3(uv, 1));
cam(p);
cam(rd);
const float steps = 30.;
float dd =.0;
for (float i=.0; i<steps; i++) {
p.z -= 4.;
p.xz *= rot(T*.2);
p.yz *= rot(sin(T*.2)*.5);
p.zx *= rot(orbit(p.zx, 12.));
float a = p.x;
p.yx *= rot(orbit(p.yx, 2.));
float b = p.x-T;
p.x = fract(b-.5)-.5;
float d = length(p)-(a-S(b+.05,b,T)*30.)*(cos(T)*5e-2+1e-1)*1e-1;
dd += d;
col += (hue(dd)*.04)/(1.+abs(d)*40.);
p = rd * dd;
}
fragColor = vec4(col, 1);
}
`;

function compile(shader, source) {
gl.shaderSource(shader, source);
gl.compileShader(shader);
if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
console.error(gl.getShaderInfoLog(shader));
}
}

let program;

function setup() {
const vs = gl.createShader(gl.VERTEX_SHADER);
const fs = gl.createShader(gl.FRAGMENT_SHADER);
compile(vs, vertexSource);
compile(fs, fragmentSource);
program = gl.createProgram();
gl.attachShader(program, vs);
gl.attachShader(program, fs);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
console.error(gl.getProgramInfoLog(program));
}
}

let vertices, buffer;

function initWebGL() {
vertices = [
-1., -1., 1.,
-1., -1., 1.,
-1., 1., 1.,
-1., 1., 1.,
];
buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
const position = gl.getAttribLocation(program, "position");
gl.enableVertexAttribArray(position);
gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
program.resolution = gl.getUniformLocation(program, "resolution");
program.time = gl.getUniformLocation(program, "time");
program.touch = gl.getUniformLocation(program, "touch");
program.pointerCount = gl.getUniformLocation(program, "pointerCount");
}

let lastTime = 0;

function loop(now) {
const deltaTime = (now - lastTime) / 1000;
lastTime = now;
gl.clearColor(0, 0, 0, 1);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.useProgram(program);
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.uniform2f(program.resolution, canvas.width, canvas.height);
gl.uniform1f(program.time, now * 1e-3);
gl.uniform2f(program.touch, 0, 0); // 不再使用鼠标位置
gl.uniform1i(program.pointerCount, 0); // 不再使用触摸点数
gl.drawArrays(gl.TRIANGLES, 0, vertices.length *.5);
requestAnimationFrame(loop);
}

function resize() {
const { innerWidth: width, innerHeight: height } = window;
// Check if the device is a mobile and if the height is smaller due to the keyboard being open
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const minHeight = window.screen.availHeight * 0.7; // Threshold to detect keyboard
if (isMobile && height < minHeight) {
// Do not resize if the keyboard is active on mobile
return;
}
canvas.width = width * dpr;
canvas.height = height * dpr;
gl.viewport(0, 0, width * dpr, height * dpr);
}

// 初始化WebGL背景
setup();
initWebGL();
resize();
loop(0);

// 代币兑换平台代码
// 合约ABI（简化版本，可根据需要扩展）
const contractABI = [
    "function exchangeTokens() external payable",
    "function getRemainingMLC() external view returns (uint256)",
    "function getSaleInfo() external view returns (bool, uint256, uint256, uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function saleActive() external view returns (bool)",
    "function totalSold() external view returns (uint256)",
    "event TokensPurchased(address indexed buyer, uint256 polAmount, uint256 mlcAmount)"
];

// 合约地址（部署后更新此地址）
let contractAddress = "YOUR_CONTRACT_ADDRESS";

// 全局变量
let provider, signer, contract, userAddress;
let saleInfo = {
    active: false,
    remaining: 0,
    sold: 0,
    rate: 100
};

// DOM元素
const connectWalletBtn = document.getElementById('connect-wallet');
const exchangeBtn = document.getElementById('exchange-btn');
const polAmountInput = document.getElementById('pol-amount');
const walletAddress = document.getElementById('wallet-address');
const polBalanceSpan = document.getElementById('pol-balance');
const mlcBalanceSpan = document.getElementById('mlc-balance');
const mlcAmountSpan = document.getElementById('mlc-amount');
const statusMessage = document.getElementById('status-message');
const saleStatus = document.getElementById('sale-status');
const tokensSold = document.getElementById('tokens-sold');
const tokensRemaining = document.getElementById('tokens-remaining');
const saleProgress = document.getElementById('sale-progress');
const progressPercent = document.getElementById('progress-percent');
const networkName = document.getElementById('network-name');
const contractAddressInput = document.getElementById('contract-address');
const setContractBtn = document.getElementById('set-contract-btn');

// 初始化
async function init() {
    if (typeof window.ethereum !== 'undefined') {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await checkNetwork();
        await loadContract();
        
        connectWalletBtn.addEventListener('click', connectWallet);
        polAmountInput.addEventListener('input', updateMlcAmount);
        exchangeBtn.addEventListener('click', exchangeTokens);
        setContractBtn.addEventListener('click', setContractAddress);
        
        // 监听账户变化
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
        
        // 尝试自动连接
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
            await connectWallet();
        }
    } else {
        showStatus("未检测到Web3钱包（如MetaMask），请安装钱包后刷新页面", "error");
        connectWalletBtn.disabled = true;
    }
}

// 设置合约地址
function setContractAddress() {
    const newAddress = contractAddressInput.value.trim();
    if (newAddress) {
        contractAddress = newAddress;
        showStatus("合约地址已更新", "success");
        loadContract();
    } else {
        showStatus("请输入有效的合约地址", "error");
    }
}

// 检查网络
async function checkNetwork() {
    try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        // Sepolia测试网Chain ID: 0xaa36a7, Polygon主网: 0x89
        const networkMap = {
            '0x1': 'Ethereum主网',
            '0x89': 'Polygon主网',
            '0x13881': 'Mumbai测试网',
            '0xaa36a7': 'Sepolia测试网'
        };
        
        networkName.textContent = networkMap[chainId] || `未知网络 (${chainId})`;
        
        // 如果是已知测试网或主网，不需要切换
        if (chainId in networkMap) {
            return true;
        }
        
        // 如果是未知网络，尝试切换到Polygon
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x89' }], // 切换到Polygon主网
            });
            return true;
        } catch (error) {
            console.error("切换网络失败:", error);
            return false;
        }
    } catch (error) {
        console.error("检查网络失败:", error);
        return false;
    }
}

// 加载合约
async function loadContract() {
    if (provider) {
        try {
            signer = provider.getSigner();
            contract = new ethers.Contract(contractAddress, contractABI, signer);
            
            // 监听合约事件
            contract.on("TokensPurchased", (buyer, polAmount, mlcAmount, event) => {
                if (userAddress && buyer.toLowerCase() === userAddress.toLowerCase()) {
                    showStatus(`兑换成功! 获得 ${ethers.utils.formatUnits(mlcAmount, 1)} MLC`, "success");
                    updateBalances();
                    updateSaleInfo();
                }
                addTransactionToList(buyer, polAmount, mlcAmount);
            });
            
            showStatus("合约加载成功", "success");
        } catch (error) {
            console.error("加载合约失败:", error);
            showStatus("加载合约失败，请检查合约地址", "error");
        }
    }
}

// 连接钱包
async function connectWallet() {
    try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const accounts = await provider.listAccounts();
        userAddress = accounts[0];
        
        walletAddress.textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
        connectWalletBtn.textContent = "切换账户";
        
        await updateBalances();
        await updateSaleInfo();
        exchangeBtn.disabled = false;
        
        showStatus("钱包连接成功", "success");
        
    } catch (error) {
        showStatus("连接钱包失败: " + error.message, "error");
    }
}

// 处理账户变化
async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        walletAddress.textContent = "未连接钱包";
        polBalanceSpan.textContent = "0";
        mlcBalanceSpan.textContent = "0";
        connectWalletBtn.textContent = "连接钱包";
        exchangeBtn.disabled = true;
        showStatus("钱包已断开连接", "warning");
    } else {
        userAddress = accounts[0];
        walletAddress.textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
        await updateBalances();
        await updateSaleInfo();
        showStatus("已切换到新账户", "success");
    }
}

// 处理网络变化
async function handleChainChanged(chainId) {
    window.location.reload();
}

// 更新余额
async function updateBalances() {
    if (!provider || !userAddress) return;
    
    try {
        // 获取POL余额
        const polBalance = await provider.getBalance(userAddress);
        polBalanceSpan.textContent = ethers.utils.formatEther(polBalance).substring(0, 8);
        
        // 获取MLC余额
        if (contract) {
            const mlcBalance = await contract.balanceOf(userAddress);
            mlcBalanceSpan.textContent = ethers.utils.formatUnits(mlcBalance, 1);
        }
    } catch (error) {
        console.error("更新余额失败:", error);
    }
}

// 更新销售信息
async function updateSaleInfo() {
    if (!contract) return;
    
    try {
        const [isActive, remaining, sold, rate] = await contract.getSaleInfo();
        
        saleInfo.active = isActive;
        saleInfo.remaining = remaining;
        saleInfo.sold = sold;
        saleInfo.rate = rate;
        
        // 更新UI
        saleStatus.textContent = isActive ? "进行中" : "已结束";
        saleStatus.className = isActive ? "sale-status status-active" : "sale-status status-inactive";
        
        tokensSold.textContent = ethers.utils.formatUnits(sold, 1) + " MLC";
        tokensRemaining.textContent = ethers.utils.formatUnits(remaining, 1) + " MLC";
        
        // 更新进度条
        const totalSale = Number(ethers.utils.formatUnits(remaining, 1)) + Number(ethers.utils.formatUnits(sold, 1));
        const progress = totalSale > 0 ? (Number(ethers.utils.formatUnits(sold, 1)) / totalSale) * 100 : 0;
        saleProgress.style.width = `${progress}%`;
        progressPercent.textContent = progress.toFixed(1);
        
    } catch (error) {
        console.error("获取销售信息失败:", error);
    }
}

// 更新MLC数量
function updateMlcAmount() {
    const polAmount = parseFloat(polAmountInput.value) || 0;
    const mlcAmount = polAmount * 100; // 1 POL = 100 MLC
    mlcAmountSpan.textContent = mlcAmount.toLocaleString() + " MLC";
}

// 兑换代币
async function exchangeTokens() {
    const polAmount = polAmountInput.value;
    if (!polAmount || polAmount <= 0) {
        showStatus("请输入有效的POL数量", "error");
        return;
    }
    
    if (!saleInfo.active) {
        showStatus("销售已结束，无法兑换", "error");
        return;
    }
    
    try {
        exchangeBtn.disabled = true;
        showStatus("交易处理中...", "");
        
        const value = ethers.utils.parseEther(polAmount);
        const transaction = await contract.exchangeTokens({ value });
        
        showStatus("交易已提交，等待确认...", "");
        
        const receipt = await transaction.wait();
        
        // 更新余额和销售信息
        await updateBalances();
        await updateSaleInfo();
        polAmountInput.value = "";
        updateMlcAmount();
        
    } catch (error) {
        console.error("兑换失败:", error);
        showStatus("兑换失败: " + (error.message || error.data?.message || "未知错误"), "error");
    } finally {
        exchangeBtn.disabled = false;
    }
}

// 添加交易到列表
function addTransactionToList(buyer, polAmount, mlcAmount) {
    const transactionList = document.getElementById('transaction-list');
    
    if (transactionList.textContent === "暂无交易记录") {
        transactionList.textContent = "";
    }
    
    const transactionItem = document.createElement('div');
    transactionItem.className = 'transaction-item';
    transactionItem.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <div>${buyer.substring(0, 6)}...${buyer.substring(38)}</div>
            <div>${ethers.utils.formatEther(polAmount)} POL → ${ethers.utils.formatUnits(mlcAmount, 1)} MLC</div>
        </div>
    `;
    
    transactionList.prepend(transactionItem);
    
    // 限制只显示最近5条交易
    if (transactionList.children.length > 5) {
        transactionList.removeChild(transactionList.lastChild);
    }
}

// 显示状态消息
function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = "status";
    
    if (type) {
        statusMessage.classList.add(type);
    }
    
    // 5秒后隐藏消息（如果是成功或错误消息）
    if (type === "success" || type === "error") {
        setTimeout(() => {
            statusMessage.className = "status";
            statusMessage.textContent = "";
        }, 5000);
    }
}

// 页面加载时初始化
window.addEventListener('load', init);