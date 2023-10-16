docker run --gpus all -it --rm sam1902/test-tensorflow:latest
docker run --gpus all -it --rm tensorflow/tensorflow:latest-gpu    python -c "import tensorflow as tf; print(tf.reduce_sum(tf.random.normal([1000, 1000])))"
docker run --runtime=nvidia -it --rm tensorflow/tensorflow:latest-gpu    python -c "import tensorflow as tf; print(tf.reduce_sum(tf.random.normal([1000, 1000])))"
