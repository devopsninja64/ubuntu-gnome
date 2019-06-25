cd ~/Downloads
###sudo visudo
voltaire ALL=(ALL) NOPASSWD: ALL
### install vim
sudo apt-get install -y vim
### install inconsolata font
sudo apt-get install fonts-inconsolata -y
sudo fc-cache -fv
### install terminator
sudo apt-get update
sudo apt-get install -y terminator

### install terminology
sudo add-apt-repository ppa:enlightenment-git/ppa
sudo apt-get update
sudo apt-get install -y terminology

### install vscode
#download .deb package
#sudo dpkg -i <file>.deb
#sudo apt-get install -f # Install dependencies

### install vscode
curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.gpg
sudo mv microsoft.gpg /etc/apt/trusted.gpg.d/microsoft.gpg
sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/vscode stable main" > /etc/apt/sources.list.d/vscode.list'
sudo apt-get update
sudo apt-get install -y code # or code-insiders

# set as default text editor
sudo update-alternatives --set editor /usr/bin/code

### install chrome
sudo apt-get install -y libxss1 libappindicator1 libindicator7
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome*.deb

### install dropbox
sudo nano /etc/apt/sources.list
# deb [arch=i386,amd64] http://linux.dropbox.com/ubuntu wily main
sudo apt-key adv --keyserver pgp.mit.edu --recv-keys 1C61A2656FB57B7E4DE0F4C1FC918B335044912E
sudo apt update
sudo apt install -y dropbox python-gpgme
dropbox start

### intall latpass cli
sudo apt update
sudo apt install lastpass-cli

### install lastpass universal installer
# download lplinux.tar.bz2
tar xjvf lplinux.tar.bz2
cd lplinux && ./install_lastpass.sh




### install docker
### setup printer
### install git
sudo apt-get update
sudo apt-get upgrade -y 
sudo apt-get install -y git
### install curl
sudo apt-get install -y curl

### install docker
sudo apt-get update
sudo apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo apt-key fingerprint 0EBFCD88
sudo add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"
sudo apt-get update
sudo apt-get install -y docker-ce

### install kubernetes cli
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl
chmod +x ./kubectl
sudo mv ./kubectl /usr/local/bin/kubectl

### install azure cli
echo "deb [arch=amd64] https://packages.microsoft.com/repos/azure-cli/ wheezy main" | \
     sudo tee /etc/apt/sources.list.d/azure-cli.list
sudo apt-key adv --keyserver packages.microsoft.com --recv-keys 417A0893
sudo apt-get install -y apt-transport-https
sudo apt-get update && sudo apt-get install -y azure-cli

### install viber
wget -O viber64-NoobsLab.com.deb http://download.cdn.viber.com/cdn/desktop/Linux/viber.deb  
sudo dpkg -i viber64-NoobsLab.com.deb

### install whatsapp
sudo dpkg -i whatsapp-webapp_1.0_all.deb

### install mono fiddler
sudo apt-get install mono-complete
mono Fiddler.exe

### instal compizconfig
sudo apt-get install -y compizconfig-settings-manager

### 
# about:config on browser
# layout.css.devPixelsPerPx=0.9

### install powershell
sudo apt-get install -y libunwind8 libicu55
wget https://github.com/PowerShell/PowerShell/releases/download/v6.0.0-alpha.9/powershell_6.0.0-alpha.9-1ubuntu1.16.04.1_amd64.deb
sudo dpkg -i powershell_6.0.0-alpha.9-1ubuntu1.16.04.1_amd64.deb


### install diff tool meld
sudo apt-get install -y meld

### install .NET
# add product key
curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.gpg
sudo mv microsoft.gpg /etc/apt/trusted.gpg.d/microsoft.gpg
sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/microsoft-ubuntu-xenial-prod xenial main" > /etc/apt/sources.list.d/dotnetdev.list'

# install .net sdk
sudo apt-get update
sudo apt-get install -y dotnet-sdk-2.0.2

# install dark background white text
sudo install-mozilla-addon https://addons.mozilla.org/firefox/downloads/file/774205/dark_background_and_light_text-0.6.6-an+fx.xpi
 

