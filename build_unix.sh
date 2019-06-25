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
### install chrome
sudo apt-get install -y libxss1 libappindicator1 libindicator7
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome*.deb
rm -rf google-chrome*.deb
### install git
sudo apt-get install -y git
### install vscode
sudo apt-get install -y curl
curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.gpg
sudo mv microsoft.gpg /etc/apt/trusted.gpg.d/microsoft.gpg
sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/vscode stable main" > /etc/apt/sources.list.d/vscode.list'
sudo apt-get update
sudo apt-get install -y code # or code-insiders
# set as default text editor
sudo update-alternatives --set editor /usr/bin/code
### install docker
sudo apt-get update
sudo apt-get install -y \
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
### add user to docker group
sudo usermod -aG docker $USER
### install kubernetes cli
#curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl
curl -LO https://storage.googleapis.com/kubernetes-release/release/v1.8/bin/linux/amd64/kubectl
chmod +x ./kubectl
sudo mv ./kubectl /usr/local/bin/kubectl
### install azure cli
echo "deb [arch=amd64] https://packages.microsoft.com/repos/azure-cli/ wheezy main" | \
     sudo tee /etc/apt/sources.list.d/azure-cli.list
sudo apt-key adv --keyserver packages.microsoft.com --recv-keys 417A0893
sudo apt-get install -y apt-transport-https
sudo apt-get update && sudo apt-get install -y azure-cli

### install diff tool meld
sudo apt-get install -y meld

####################
#sudo add-apt-repository universe
sudo apt install -y gnome-tweak-tool
gnome-shell --version
sudo apt install -y gnome-shell-extensions
sudo apt install -y chrome-gnome-shell
#dash to dock
#dash to panel
#compton
### materia gtk2/3 theme
sudo apt install materia-gtk-theme
### papirus icon theme
sudo add-apt-repository ppa:papirus/papirus
sudo apt-get update
sudo apt-get install papirus-icon-theme
####################


### install terminology
sudo add-apt-repository ppa:enlightenment-git/ppa
sudo apt-get update
sudo apt-get install -y terminology
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
