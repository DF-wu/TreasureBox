#If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH

#-----------------php setting start-----------------
export PATH=/Applications/XAMPP/xamppfiles/bin:$PATH
#-----------------php setting end-----------------


#------------------------java setting start-------------
# 设置 jdk11
export JAVA_11_HOME=`/usr/libexec/java_home -v 11`
# 设置 jdk13
export JAVA_13_HOME=`/usr/libexec/java_home -v 13`

# 默认 jdk 使用11版本
export JAVA_HOME=$JAVA_11_HOME

# alias 命令动态切换 jdk 版本

alias jdk11="export JAVA_HOME=$JAVA_11_HOME"
alias jdk13="export JAVA_HOME=$JAVA_13_HOME"

#alias code= "open -a \Visual \ Code\"
#alias code=vscode
vscode(){
        filename=$1
        open -a Visual\ Studio\ Code $filename;
}
# 作者：laberat
# 链接：https://www.jianshu.com/p/af79ae7f732c
# 來源：简书
# 简书著作权归作者所有，任何形式的转载都请联系作者获得授权并注明出处。
#------------------------java setting end -----------------

#--------------------------nvm start---------------------

#--------------------------nvm end-----------------------




#-----------------chromedriver start-------------------

export PATH="/Users/chufei:$PATH"
#-----------------chromedriver end -------------------

# added by Anaconda3 4.4.0 installer
# export PATH="/anaconda/bin:$PATH"  # commented out by conda initialize
#maven apache-maven-3.5.4
export PATH="/Users/chufei/Maven/bin:$PATH"

# Path to your oh-my-zsh installation.
export ZSH="/Users/chufei/.oh-my-zsh"




# Set name of the theme to load --- if set to "random", it will
# load a random theme each time oh-my-zsh is loaded, in which case,
# to know which specific one was loaded, run: echo $RANDOM_THEME
# See https://github.com/robbyrussell/oh-my-zsh/wiki/Themes


POWERLEVEL9K_MODE='nerdfont-complete'
ZSH_THEME="agnoster"

# command line 左邊想顯示的內容
POWERLEVEL9K_LEFT_PROMPT_ELEMENTS=(anaconda dir dir_writable context os_icon) # <= left prompt 設了 "dir"
# command line 右邊想顯示的內容
POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS=(time status ram load battery background_jobs history) # <= right prompt 設了 "time"


# Set list of themes to pick from when loading at random
# Setting this variable when ZSH_THEME=random will cause zsh to load
# a theme from this variable instead of looking in ~/.oh-my-zsh/themes/
# If set to an empty array, this variable will have no effect.
# ZSH_THEME_RANDOM_CANDIDATES=( "robbyrussell" "agnoster" )

# Uncomment the following line to use case-sensitive completion.
# CASE_SENSITIVE="true"

# Uncomment the following line to use hyphen-insensitive completion.
# Case-sensitive completion must be off. _ and - will be interchangeable.
# HYPHEN_INSENSITIVE="true"

# Uncomment the following line to disable bi-weekly auto-update checks.
# DISABLE_AUTO_UPDATE="true"

# Uncomment the following line to change how often to auto-update (in days).
# export UPDATE_ZSH_DAYS=13

# Uncomment the following line to disable colors in ls.
# DISABLE_LS_COLORS="true"

# Uncomment the following line to disable auto-setting terminal title.
# DISABLE_AUTO_TITLE="true"

# Uncomment the following line to enable command auto-correction.
# ENABLE_CORRECTION="true"

# Uncomment the following line to display red dots whilst waiting for completion.
# COMPLETION_WAITING_DOTS="true"

# Uncomment the following line if you want to disable marking untracked files
# under VCS as dirty. This makes repository status check for large repositories
# much, much faster.
# DISABLE_UNTRACKED_FILES_DIRTY="true"

# Uncomment the following line if you want to change the command execution time
# stamp shown in the history command output.
# You can set one of the optional three formats:
# "mm/dd/yyyy"|"dd.mm.yyyy"|"yyyy-mm-dd"
# or set a custom format using the strftime function format specifications,
# see 'man strftime' for details.
# HIST_STAMPS="mm/dd/yyyy"

# Would you like to use another custom folder than $ZSH/custom?
# ZSH_CUSTOM=/path/to/new-custom-folder

# Which plugins would you like to load?
# Standard plugins can be found in ~/.oh-my-zsh/plugins/*
# Custom plugins may be added to ~/.oh-my-zsh/custom/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(
  git
  z
  zsh-syntax-highlighting
  zsh-autosuggestions
  
)

source $ZSH/oh-my-zsh.sh
source /usr/local/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
#--------------------------------------------
# User configuration

# export MANPATH="/usr/local/man:$MANPATH"

# You may need to manually set your language environment
# export LANG=en_US.UTF-8

# Preferred editor for local and remote sessions
# if [[ -n $SSH_CONNECTION ]]; then
#   export EDITOR='vim'
# else
#   export EDITOR='mvim'
# fi

# Compilation flags
# export ARCHFLAGS="-arch x86_64"

# ssh
# export SSH_KEY_PATH="~/.ssh/rsa_id"

# Set personal aliases, overriding those provided by oh-my-zsh libs,
# plugins, and themes. Aliases can be placed here, though oh-my-zsh
# users are encouraged to define aliases within the ZSH_CUSTOM folder.
# For a full list of active aliases, run `alias`.
#
# Example aliases
# alias zshconfig="mate ~/.zshrc"
# alias ohmyzsh="mate ~/.oh-my-zsh"



# Why must zsh-syntax-highlighting.zsh be sourced at the end of the .zshrc file? yes must
source /usr/local/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# >>> conda initialize >>>
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$('/anaconda/bin/conda' 'shell.zsh' 'hook' 2> /dev/null)"
if [ $? -eq 0 ]; then
    eval "$__conda_setup"
else
    if [ -f "/anaconda/etc/profile.d/conda.sh" ]; then
        . "/anaconda/etc/profile.d/conda.sh"
    else
        export PATH="/anaconda/bin:$PATH"
    fi
fi
unset __conda_setup
# <<< conda initialize <<<

